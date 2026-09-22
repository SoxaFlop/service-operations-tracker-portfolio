/**
 * orders.ts — Order Routes
 *
 * Handles all CRUD operations for Orders. Includes:
 *   - GET    /              — list all orders with client and audit history
 *   - POST   /              — create a new order at the first workflow step
 *   - PUT    /:id           — update/move an order; triggers SLA checks and notifications
 *   - DELETE /:id           — admin-only hard delete
 *
 * All database queries use withRetry to handle transient connection timeouts.
 */

import { Router, Request, Response } from 'express';
import { prisma, withRetry } from '../db.js';
import { authMiddleware } from './auth.js';
import { sendEmail } from '../smtp.js';
import { getInitialStatus, getLastStepId } from '../workflow.js';
import { notifyStepArrival, checkSlaViolations, sendCompletionViolationReport, notifyNotesAdded } from '../notifications.js';
import { parseStoredDocument } from '../lib/document.js';
import { wrapEmail } from '../lib/emailTemplate.js';

const router = Router();
router.use(authMiddleware);

/** Fields that are allowed to be updated on an order via PUT. */
const UPDATABLE_ORDER_FIELDS = [
  'clientName', 'clientId', 'products', 'status', 'category',
  'assignedTo', 'assignedEmail', 'notes', 'quoteAmount', 'supplierQuoteNumber',
  'bdmId',
  // Document attachments — stored as "filename$$$data:mime;base64,..." strings
  'proformaInvoiceLink', 'proformaInvoiceText',    // Pro Forma Invoice
  'taxInvoiceLink', 'taxInvoiceText',              // Tax Invoice
  'onsitePurchaseOrderLink', 'onsitePurchaseOrderText', // Onsite PO
  'onsiteQuoteLink', 'onsiteQuoteText',            // Onsite Quote
  'customerQuoteLink', 'customerQuoteText',        // Customer Quote
  'customerPopLink',                               // Customer Proof of Payment
  'onsiteTaxInvoiceLink',                          // Onsite Tax Invoice
  'technicalQuoteLink', 'technicalQuoteText',      // Technical Quote
  'salesQuoteLink', 'salesQuoteText',              // Sales Quote
  'customAttachments',                             // custom-labelled attachments (JSON array)
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// Fields to exclude from the main list view to save network bandwidth (Public Network Transfer)
const EXCLUDE_FROM_LIST = {
  notes: false,
  proformaInvoiceLink: false,
  proformaInvoiceText: false,
  taxInvoiceLink: false,
  taxInvoiceText: false,
  onsitePurchaseOrderLink: false,
  onsitePurchaseOrderText: false,
  onsiteQuoteLink: false,
  onsiteQuoteText: false,
  customerQuoteLink: false,
  customerQuoteText: false,
  customerPopLink: false,
  onsiteTaxInvoiceLink: false,
  technicalQuoteLink: false,
  technicalQuoteText: false,
  salesQuoteLink: false,
  salesQuoteText: false,
};

/** GET / — Return all orders summary (excluding large documents), newest first. */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [orders, requirements] = await Promise.all([
      withRetry(() =>
        prisma.order.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
            dbId: true, id: true, clientName: true, clientId: true, category: true,
            status: true, assignedTo: true, assignedEmail: true, quoteAmount: true,
            createdAt: true, updatedAt: true, supplierQuoteNumber: true,
            products: true, licenseType: true, licenseCount: true,
            slaViolation: true,
            client: true,
            audits: { where: { completedAt: null }, take: 1 },
            creator: { select: { displayName: true } },
            assignees: { select: { id: true, displayName: true } }
          }
        })
      ),
      withRetry(() => prisma.stepAttachmentRequirement.findMany()),
    ]);

    // Build a map of stepId → required doc fields
    const reqMap: Record<string, string[]> = {};
    for (const r of requirements) {
      const docs = r.documents.split(',').map((d: string) => d.trim()).filter(Boolean);
      if (docs.length > 0) reqMap[r.step] = docs;
    }

    // For steps that have requirements, find which order IDs are missing at least one required doc.
    // We query only for null-checks (no base64 data read) to keep bandwidth low.
    const blockedIds = new Set<string>();
    const missingMap: Record<string, string[]> = {};

    const stepsWithReqs = Object.keys(reqMap);
    if (stepsWithReqs.length > 0) {
      for (const step of stepsWithReqs) {
        const docFields = reqMap[step];
        // Select only dbId + the required doc fields (null-check only, no base64 read)
        const selectFields: Record<string, true> = { dbId: true };
        docFields.forEach((f: string) => { selectFields[f] = true; });
        const missingOrders = await withRetry(() =>
          prisma.order.findMany({
            where: { status: step, OR: docFields.map((f: string) => ({ [f]: null })) },
            select: selectFields as any,
          })
        ) as Array<Record<string, any>>;
        for (const o of missingOrders) {
          blockedIds.add(o.dbId);
          missingMap[o.dbId] = docFields.filter((f: string) => !o[f]);
        }
      }
    }

    const result = orders.map(o => ({
      ...o,
      advanceBlocked: blockedIds.has(o.dbId),
      missingRequiredDocs: missingMap[o.dbId] ?? [],
    }));

    res.json(result);
  } catch (error) {
    console.error('[Orders] List error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/** GET /:id — Return full details for a specific order, including documents. */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await withRetry(() =>
      prisma.order.findUnique({
        where: { dbId: id },
        include: {
          client: true,
          audits: true,
          creator: { select: { displayName: true } },
          bdm: { select: { email: true, displayName: true } },
          assignees: { select: { id: true, displayName: true, email: true, role: true } },
        }
      })
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    console.error('[Orders] Get error:', error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

/** POST / — Create a new order, automatically assigned to the first workflow step. */
router.post('/', async (req: any, res: Response): Promise<any> => {
  if (['viewer', 'bdm', 'ops'].includes(req.user.role)) return res.status(403).json({ error: 'Admin access required to create orders' });
  try {
    const {
      clientName, licenseType, licenseCount, category, products, clientId,
      onsiteQuoteLink, onsiteQuoteText,
      customerQuoteLink, customerQuoteText,
      technicalQuoteLink,
      salesQuoteLink,
      proformaInvoiceLink, proformaInvoiceText,
      customerPopLink,
      onsitePurchaseOrderLink, onsitePurchaseOrderText,
      onsiteTaxInvoiceLink,
      taxInvoiceLink, taxInvoiceText,
    } = req.body;

    if (!clientName || (!licenseType && (!products || products.length === 0))) {
      return res.status(400).json({ error: 'Missing required fields: clientName and at least one product or licenseType.' });
    }

    const initialStatus = await getInitialStatus();

    const order = await withRetry(() =>
      prisma.order.create({
        data: {
          id: `DEMO-${Math.floor(1000 + Math.random() * 9000)}`,
          clientName,
          clientId: clientId ?? null,
          licenseType: licenseType ?? '',
          licenseCount: licenseCount ?? 1,
          products: products ?? [],
          status: initialStatus,
          category: category ?? 'device_management',
          assignedTo: req.user.displayName ?? 'Unassigned',
          assignedEmail: req.user.email ?? '',
          createdBy: req.user.id,
          ...(onsiteQuoteLink           && { onsiteQuoteLink }),
          ...(onsiteQuoteText           && { onsiteQuoteText }),
          ...(customerQuoteLink         && { customerQuoteLink }),
          ...(customerQuoteText         && { customerQuoteText }),
          ...(technicalQuoteLink        && { technicalQuoteLink }),
          ...(salesQuoteLink            && { salesQuoteLink }),
          ...(proformaInvoiceLink       && { proformaInvoiceLink }),
          ...(proformaInvoiceText       && { proformaInvoiceText }),
          ...(customerPopLink           && { customerPopLink }),
          ...(onsitePurchaseOrderLink   && { onsitePurchaseOrderLink }),
          ...(onsitePurchaseOrderText   && { onsitePurchaseOrderText }),
          ...(onsiteTaxInvoiceLink      && { onsiteTaxInvoiceLink }),
          ...(taxInvoiceLink            && { taxInvoiceLink }),
          ...(taxInvoiceText            && { taxInvoiceText }),
        },
        include: { client: true },
      })
    );

    // Record the initial workflow step in the audit log
    await withRetry(() =>
      prisma.orderStepAudit.create({ data: { orderId: order.dbId, step: order.status } })
    );

    res.json(order);
  } catch (error) {
    console.error('[Orders] Create error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

/** PUT /:id — Update order fields. Handles workflow transitions, SLA checks, and notifications. */
router.put('/:id', async (req: any, res: Response): Promise<any> => {
  if (['viewer', 'bdm'].includes(req.user.role)) return res.status(403).json({ error: 'Read-only access' });
  try {
    const { id } = req.params;
    const body = req.body;

    // Fetch current state of the order
    const currentOrder = await withRetry(() =>
      prisma.order.findUnique({
        where: { dbId: id },
        include: {
          client: { include: { bdm: { select: { email: true, displayName: true } }, bdms: { where: { role: 'bdm' }, select: { email: true, displayName: true } } } },
          bdm: { select: { email: true, displayName: true } },
        },
      })
    );
    if (!currentOrder) return res.status(404).json({ error: 'Order not found' });

    // Prevent non-admins from modifying completed or terminal-status orders
    const lastStepId = await getLastStepId();
    const TERMINAL_STATUSES_GUARD = ['quote_expired', 'quote_rejected'];
    if (!['admin', 'user'].includes(req.user.role) &&
        (currentOrder.status === lastStepId || TERMINAL_STATUSES_GUARD.includes(currentOrder.status))) {
      return res.status(403).json({ error: 'Only admins can modify completed or expired orders' });
    }

    // Build a patch from only the fields that are present in the request body
    const updateData: Record<string, any> = {};
    UPDATABLE_ORDER_FIELDS.forEach(f => { if (body[f] !== undefined) updateData[f] = body[f]; });

    // Handle assignees relation separately (not a simple scalar field)
    if (body.assigneeIds !== undefined) {
      updateData.assignees = { set: (body.assigneeIds as string[]).map((uid: string) => ({ id: uid })) };
    }

    // Ops users may only update document fields and status — strip everything else
    if (req.user.role === 'ops') {
      const OPS_ALLOWED = new Set([
        'status',
        'proformaInvoiceLink', 'proformaInvoiceText',
        'taxInvoiceLink', 'taxInvoiceText',
        'onsitePurchaseOrderLink', 'onsitePurchaseOrderText',
        'onsiteQuoteLink', 'onsiteQuoteText',
        'customerQuoteLink', 'customerQuoteText',
        'customerPopLink', 'onsiteTaxInvoiceLink',
        'technicalQuoteLink', 'technicalQuoteText',
        'salesQuoteLink', 'salesQuoteText',
        'customAttachments',
      ]);
      for (const k of Object.keys(updateData)) {
        if (!OPS_ALLOWED.has(k)) delete updateData[k];
      }
    }

    // ── Handle Status Transition ─────────────────────────────────────────────
    const TERMINAL_STATUSES = ['quote_expired', 'quote_rejected'];

    if (updateData.status && updateData.status !== currentOrder.status) {
      const now = new Date();
      const isTerminalTransition = TERMINAL_STATUSES.includes(updateData.status);
      const isRenewal = TERMINAL_STATUSES.includes(currentOrder.status) && !isTerminalTransition;

      if (isTerminalTransition) {
        // Terminal transitions (reject/expire) — admin and user only
        if (!['admin', 'user'].includes(req.user.role)) {
          return res.status(403).json({ error: 'Admin access required' });
        }
        // Close the active audit only — no new audit, no notifications
        const activeAudit = await withRetry(() =>
          prisma.orderStepAudit.findFirst({
            where: { orderId: id, completedAt: null },
            orderBy: { startedAt: 'desc' },
          })
        );
        if (activeAudit) {
          await withRetry(() =>
            prisma.orderStepAudit.update({
              where: { id: activeAudit.id },
              data: { completedAt: now, movedById: req.user.id, movedByName: req.user.displayName } as any,
            })
          );
        }
      } else if (isRenewal) {
        // Renewals — admin and user only
        if (!['admin', 'user'].includes(req.user.role)) {
          return res.status(403).json({ error: 'Admin access required' });
        }
        await withRetry(() =>
          prisma.orderStepAudit.create({ data: { orderId: id, step: updateData.status } })
        );
        await notifyStepArrival(currentOrder, updateData.status);
      } else {
        // Normal workflow transition — enforce required attachments first
        const requirement = await withRetry(() =>
          prisma.stepAttachmentRequirement.findUnique({ where: { step: currentOrder.status } })
        );
        if (requirement?.documents) {
          const docFields = requirement.documents.split(',').map((d: string) => d.trim()).filter(Boolean);
          const DOC_LABELS: Record<string, string> = {
            onsiteQuoteLink: 'Onsite Quote', technicalQuoteLink: 'Technical Quote',
            salesQuoteLink: 'Sales Quote', proformaInvoiceLink: 'Pro Forma Invoice',
            customerPopLink: 'Customer POP', onsitePurchaseOrderLink: 'Onsite PO',
            onsiteTaxInvoiceLink: 'Onsite Tax Invoice', taxInvoiceLink: 'Tax Invoice',
            customerQuoteLink: 'Customer Quote',
          };
          const missing = docFields.filter((f: string) => !currentOrder[f as keyof typeof currentOrder]);
          if (missing.length > 0) {
            const labels = missing.map((f: string) => DOC_LABELS[f] ?? f).join(', ');
            return res.status(422).json({
              error: `Cannot advance: missing required attachment${missing.length > 1 ? 's' : ''}: ${labels}`,
              missing,
            });
          }
        }

        const stepAssignments = await withRetry(() =>
          prisma.stepAssignment.findMany({ where: { step: currentOrder.status } })
        );
        const thisUserAssignment = stepAssignments.find((a: any) => a.userId === req.user.id) as any;
        const advancers = stepAssignments.filter((a: any) => a.canAdvance);
        if (thisUserAssignment && !thisUserAssignment.canAdvance) {
          return res.status(403).json({ error: 'You do not have permission to advance this step' });
        }
        if (advancers.length > 0 && !advancers.some((a: any) => a.userId === req.user.id)) {
          return res.status(403).json({ error: 'You do not have permission to advance this step' });
        }

        const activeAudit = await withRetry(() =>
          prisma.orderStepAudit.findFirst({
            where: { orderId: id, step: currentOrder.status, completedAt: null },
            orderBy: { startedAt: 'desc' },
          })
        );
        if (activeAudit) {
          await withRetry(() =>
            prisma.orderStepAudit.update({
              where: { id: activeAudit.id },
              data: { completedAt: now, movedById: req.user.id, movedByName: req.user.displayName } as any,
            })
          );
          await checkSlaViolations(currentOrder, activeAudit, now);
        }

        await withRetry(() =>
          prisma.orderStepAudit.create({ data: { orderId: id, step: updateData.status } })
        );
        await notifyStepArrival(currentOrder, updateData.status);
        // Merge any document fields from this same request so triggers see the latest attachments
        const orderForTriggers = { ...currentOrder, ...updateData };
        const [fromStep, toStep] = await Promise.all([
          withRetry(() => prisma.workflowStep.findUnique({ where: { id: currentOrder.status }, select: { position: true } })),
          withRetry(() => prisma.workflowStep.findUnique({ where: { id: updateData.status }, select: { position: true } })),
        ]);
        const isForwardMove = (toStep?.position ?? 0) > (fromStep?.position ?? 0);
        if (isForwardMove) {
          await handleDocumentTriggers(orderForTriggers, currentOrder.status);
          await handleThankYouEmail(orderForTriggers, currentOrder.status);
        }

        if (updateData.status === lastStepId) {
          const hadViolations = await sendCompletionViolationReport(currentOrder);
          if (hadViolations) updateData.slaViolation = true;
        }
      }
    }

    const updated = await withRetry(() =>
      prisma.order.update({
        where: { dbId: id },
        data: updateData,
        include: {
          client: true,
          assignees: { select: { id: true, displayName: true, email: true, role: true } },
        },
      })
    );

    // Notify step assignees when notes are added or changed (fire-and-forget)
    if (updateData.notes !== undefined && updateData.notes !== currentOrder.notes && updateData.notes?.trim()) {
      notifyNotesAdded(currentOrder, updateData.notes, req.user.email ?? '', req.user.displayName ?? 'Someone').catch(() => {});
    }

    res.json(updated);
  } catch (error) {
    console.error('[Orders] Update error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

/** POST /:id/reset-client-reminders — Reset the client POP reminder cycle for the active step. */
router.post('/:id/reset-client-reminders', async (req: any, res: Response): Promise<any> => {
  if (['viewer', 'bdm'].includes(req.user.role)) return res.status(403).json({ error: 'Read-only access' });
  try {
    const { id } = req.params;
    const activeAudit = await withRetry(() =>
      prisma.orderStepAudit.findFirst({
        where: { orderId: id, completedAt: null },
        orderBy: { startedAt: 'desc' },
      })
    );
    if (!activeAudit) return res.status(404).json({ error: 'No active audit found' });
    await withRetry(() =>
      prisma.orderStepAudit.update({
        where: { id: activeAudit.id },
        data: {
          clientReminderResetAt: new Date(),
          clientReminder5Sent: false,
          clientReminder7Sent: false,
          clientExpiredSent: false,
        } as any,
      })
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to reset client reminders' });
  }
});

/** DELETE /:id — Hard delete an order and its audit log. Admin only. */
router.delete('/:id', async (req: any, res: Response): Promise<any> => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Read-only access' });
  try {
    if (!['admin', 'user'].includes(req.user.role)) return res.status(403).json({ error: 'Admin access required' });

    const { id } = req.params;
    await withRetry(() => prisma.orderStepAudit.deleteMany({ where: { orderId: id } }));
    await withRetry(() => prisma.order.delete({ where: { dbId: id } }));

    res.json({ success: true });
  } catch (error) {
    console.error('[Orders] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// ─── Private Helpers ──────────────────────────────────────────────────────────

const DEFAULT_THANKYOU_SUBJECT = 'Thank you for your order — {clientName}';
const DEFAULT_THANKYOU_BODY = `Hi {contactName},

Thank you for your order — we truly appreciate your trust in Example Company.

Your order ({orderId}) has been received and is currently being processed. We will keep you updated as things progress.

If you have any questions or need assistance at any stage, please don't hesitate to reply to this email — our team is always here to help.

We look forward to supporting you.

Warm regards,
The Example Company Team`;

/**
 * Sends a warm thank-you email to the client when an order leaves a step that
 * has the thank-you email toggle enabled.
 */
async function handleThankYouEmail(order: any, departingStep: string): Promise<void> {
  if (!order.client?.email) return;

  const config = await withRetry(() =>
    prisma.stepThankYouEmail.findUnique({ where: { step: departingStep } })
  );
  if (!config?.enabled) return;

  const orderDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const interpolate = (template: string) =>
    template
      .replace(/\{orderId\}/g,     order.id ?? '')
      .replace(/\{contactName\}/g, order.client?.contactName ?? order.clientName ?? '')
      .replace(/\{clientName\}/g,  order.clientName ?? '')
      .replace(/\{orderDate\}/g,   orderDate);

  const subject = interpolate(config.subject ?? DEFAULT_THANKYOU_SUBJECT);
  const bodyText = interpolate(config.emailBody ?? DEFAULT_THANKYOU_BODY);
  const html = wrapEmail(
    bodyText.split('\n').map((line: string) =>
      line.trim() === '' ? '<br/>' : `<p style="margin:0 0 8px">${line}</p>`
    ).join('')
  );

  const clientCcEmails: string[] = order.client?.ccEmails
    ? (order.client.ccEmails as string).split(',').map((e: string) => e.trim()).filter(Boolean)
    : [];

  // Account Managers: order-level Account Manager + client's primary Account Manager + client's multi-Account Managers
  const bdmEmails = [
    order.bdm?.email,
    order.client?.bdm?.email,
    ...(order.client?.bdms?.map((b: any) => b.email) ?? []),
  ].filter((e): e is string => !!e);

  // Step-assigned users only — no blanket admin CC
  const assignments = await withRetry(() =>
    prisma.stepAssignment.findMany({ where: { step: departingStep }, include: { user: { select: { email: true } } } })
  );
  const assignedEmails = assignments.map((a: any) => a.user?.email).filter((e: any): e is string => !!e);

  const cc = [...new Set([...clientCcEmails, ...bdmEmails, ...assignedEmails])].filter(e => e !== order.client.email);

  await sendEmail({
    to: order.client.email,
    cc: cc.length ? cc : undefined,
    subject,
    html,
  });
}

/**
 * Sends document trigger emails for enabled triggers attached to a given step.
 * Called when an order is moved *out of* a step.
 */
async function handleDocumentTriggers(order: any, departingStep: string): Promise<void> {
  const triggers = await withRetry(() =>
    prisma.stepDocumentTrigger.findMany({ where: { step: departingStep, enabled: true } })
  );
  if (triggers.length === 0) return;

  const assignments = await withRetry(() =>
    prisma.stepAssignment.findMany({ where: { step: departingStep }, include: { user: true } })
  );
  const staffCc = assignments
    .filter(a => !!a.user?.email)
    .map(a => `${a.user.displayName} <${a.user.email}>`);

  const clientCcEmails: string[] = order.client?.ccEmails
    ? (order.client.ccEmails as string).split(',').map((e: string) => e.trim()).filter(Boolean)
    : [];

  const stepDef = await withRetry(() =>
    prisma.workflowStep.findUnique({ where: { id: departingStep } })
  );
  const stepLabel = stepDef?.label ?? departingStep;

  const DOC_LABELS: Record<string, string> = {
    onsiteQuoteLink:         'Onsite Quote',
    proformaInvoiceLink:     'Pro Forma Invoice',
    customerPopLink:         'Customer POP',
    onsitePurchaseOrderLink: 'Onsite PO',
    onsiteTaxInvoiceLink:    'Onsite Tax Invoice',
    taxInvoiceLink:          'Tax Invoice',
    technicalQuoteLink:      'Technical Quote',
    salesQuoteLink:          'Sales Quote',
  };

  const formattedAmount = order.quoteAmount != null
    ? new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(order.quoteAmount)
    : '';

  const productList = Array.isArray(order.products) && order.products.length > 0
    ? order.products.map((p: any) => `${p.quantity}x ${p.name}`).join('\n')
    : '';

  const orderDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const interpolate = (template: string) =>
    template
      .replace(/\{orderId\}/g,              order.id ?? '')
      .replace(/\{contactName\}/g,          order.client?.contactName ?? order.clientName ?? '')
      .replace(/\{clientName\}/g,           order.clientName ?? '')
      .replace(/\{clientEmail\}/g,          order.client?.email ?? '')
      .replace(/\{orderNotes\}/g,           order.notes ?? '')
      .replace(/\{stepLabel\}/g,            stepLabel)
      .replace(/\{quoteAmount\}/g,          formattedAmount)
      .replace(/\{assignedTo\}/g,           order.assignedTo ?? '')
      .replace(/\{supplierQuoteNumber\}/g,  order.supplierQuoteNumber ?? '')
      .replace(/\{productList\}/g,          productList)
      .replace(/\{orderDate\}/g,            orderDate);

  let shouldClearAttachments = false;

  for (const trigger of triggers) {
    const isClientRecipient = trigger.recipientType !== 'custom';

    // document may be comma-separated (multi-attachment) or a single field name (legacy)
    const docFields = (trigger.document ?? '').split(',').map((d: string) => d.trim()).filter(Boolean);
    const attachments = docFields
      .map((f: string) => parseStoredDocument(order[f as keyof typeof order] as string | null))
      .filter(Boolean);

    if (docFields.length === 0) {
      console.warn(`[DocTrigger] Trigger ${trigger.id} on step "${departingStep}" has no documents configured — skipping`);
      continue;
    }
    if (attachments.length === 0) {
      console.warn(`[DocTrigger] Trigger ${trigger.id}: documents [${docFields.join(', ')}] not attached to order ${order.id} — skipping`);
      continue;
    }
    if (isClientRecipient && !order.client?.email) {
      console.warn(`[DocTrigger] Trigger ${trigger.id}: recipient is "client" but order ${order.id} has no client email — skipping`);
      continue;
    }
    if (!isClientRecipient && !trigger.customEmail) {
      console.warn(`[DocTrigger] Trigger ${trigger.id}: recipient is "custom" but no custom email set — skipping`);
      continue;
    }

    const docLabel = docFields.map((f: string) => DOC_LABELS[f] ?? f).join(', ');

    const subject = trigger.subject
      ? interpolate(trigger.subject)
      : `Document Ready: ${order.id} — ${order.clientName} (${stepLabel})`;

    const bodyText = trigger.emailBody
      ? interpolate(trigger.emailBody)
      : `Please find the ${docLabel} attached for order ${order.id}.`;

    const html = wrapEmail(
      bodyText.split('\n').map((line: string) => `<p style="margin:0 0 8px">${line}</p>`).join('')
    );

    const bdmEmails = [
      (order as any).bdm?.email,
      (order as any).client?.bdm?.email,
      ...((order as any).client?.bdms?.map((b: any) => b.email) ?? []),
    ].filter((e): e is string => !!e);
    const isClientEmail = trigger.recipientType !== 'custom';
    const ccList = isClientEmail
      ? [...new Set([...staffCc, ...clientCcEmails, ...bdmEmails])]
      : staffCc;

    await sendEmail({
      to: isClientEmail ? order.client.email : trigger.customEmail,
      cc: ccList.length ? ccList : undefined,
      subject,
      html,
      attachments,
    });

    if (trigger.clearAllAttachmentsAfter) shouldClearAttachments = true;
  }

  if (shouldClearAttachments) {
    await withRetry(() =>
      prisma.order.update({
        where: { dbId: order.dbId },
        data: {
          onsiteQuoteLink:          null,
          onsiteQuoteText:          null,
          customerQuoteLink:        null,
          customerQuoteText:        null,
          proformaInvoiceLink:      null,
          proformaInvoiceText:      null,
          customerPopLink:          null,
          onsitePurchaseOrderLink:  null,
          onsitePurchaseOrderText:  null,
          onsiteTaxInvoiceLink:     null,
          taxInvoiceLink:           null,
          taxInvoiceText:           null,
          technicalQuoteLink:       null,
          technicalQuoteText:       null,
          salesQuoteLink:           null,
          salesQuoteText:           null,
        },
      })
    );
  }
}

export default router;
