/**
 * proposals.ts — Proposal Routes
 *
 * Manages the Account Manager proposal workflow:
 *   GET    /              — list proposals (Account Manager: own; admin: all)
 *   GET    /:id           — get full proposal details
 *   POST   /              — create draft (Account Manager only)
 *   PUT    /:id           — edit draft (Account Manager: own drafts only)
 *   DELETE /:id           — delete draft (Account Manager: own drafts; admin: any)
 *   POST   /:id/submit    — submit for admin approval → emails all admins
 *   POST   /:id/approve   — admin approves → emails Account Manager
 *   POST   /:id/reject    — admin rejects with notes → emails Account Manager
 *   POST   /:id/send      — send to client (admin) → emails client, CC Account Manager
 *   POST   /:id/create-order — spin up an order pre-filled from proposal
 */

import { Router, Response } from 'express';
import { prisma, withRetry } from '../db.js';
import { authMiddleware } from './auth.js';
import { sendEmail } from '../smtp.js';
import { getInitialStatus } from '../workflow.js';
import { parseStoredDocument } from '../lib/document.js';
import { wrapEmail } from '../lib/emailTemplate.js';

const router = Router();
router.use(authMiddleware);

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isBdmOrAdmin(role: string) {
  return ['bdm', 'admin', 'user'].includes(role);
}

// Matches wrapEmail()'s base font — restated explicitly here (and on the message
// wrapper below) because Outlook and other email clients don't reliably inherit
// font-family from a parent <table> several levels up, which otherwise left the
// free-form "message to client" text rendering in a different font to the greeting.
const EMAIL_BODY_FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#374151;line-height:1.6";

const DOC_FIELDS = [
  'technicalQuoteLink', 'salesQuoteLink', 'proformaInvoiceLink', 'taxInvoiceLink',
  'onsiteQuoteLink', 'customerQuoteLink', 'customerPopLink',
  'onsitePurchaseOrderLink', 'onsiteTaxInvoiceLink',
] as const;

function pickDocFields(body: Record<string, any>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const f of DOC_FIELDS) {
    if (f in body) out[f] = body[f] ?? null;
  }
  return out;
}

function buildProposalEmailHtml(proposal: any, client: any, bdm: any): string {
  const rawMsg = proposal.message ?? '';
  const message = rawMsg.trim().startsWith('<')
    ? rawMsg
    : rawMsg.split('\n').map((l: string) => `<p style="margin:0 0 12px">${l || '&nbsp;'}</p>`).join('');
  const rawSig = proposal.signature ?? `Kind regards,\n${bdm?.displayName ?? 'Service Operations Team'}`;
  const signatureHtml = rawSig.trim().startsWith('<')
    ? rawSig
    : rawSig.split('\n').map((l: string) => `<p style="margin:0;color:#6b7280;font-size:13px">${l}</p>`).join('');
  const expiryLine = proposal.expiresAt
    ? `<p style="margin:16px 0 0;font-size:13px;color:#6b7280">This proposal is valid until <strong>${new Date(proposal.expiresAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.</p>`
    : '';

  const products: any[] = Array.isArray(proposal.products) ? proposal.products.filter((p: any) => p.name) : [];
  const lineItemsHtml = products.length === 0 ? '' : (() => {
    const fmt = (n: number) => `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const rows = products.map((p: any) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:13px">${p.name}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:center;color:#6b7280">${p.quantity ?? 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right;color:#6b7280">${fmt(p.unitCost ?? 0)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right;font-weight:600">${fmt(p.lineTotal ?? 0)}</td>
      </tr>`).join('');
    const total = products.reduce((s: number, p: any) => s + (p.lineTotal ?? 0), 0);
    return `
      <table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:9px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1px solid #e5e7eb">Item</th>
            <th style="padding:9px 10px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1px solid #e5e7eb">Qty</th>
            <th style="padding:9px 10px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1px solid #e5e7eb">Unit Cost</th>
            <th style="padding:9px 10px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1px solid #e5e7eb">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:#f9fafb">
            <td colspan="3" style="padding:10px;text-align:right;font-size:13px;font-weight:700;border-top:2px solid #e5e7eb">Total</td>
            <td style="padding:10px;text-align:right;font-size:14px;font-weight:700;border-top:2px solid #e5e7eb">${fmt(total)}</td>
          </tr>
        </tfoot>
      </table>`;
  })();

  return wrapEmail(`
    <p style="margin:0 0 16px;${EMAIL_BODY_FONT}">Dear ${client?.contactName ?? client?.name ?? 'Valued Client'},</p>
    <div style="margin:0 0 16px;${EMAIL_BODY_FONT}">${message}</div>
    ${lineItemsHtml}
    ${expiryLine}
    <div style="margin:24px 0">${signatureHtml}</div>
  `);
}

function buildAdminNotificationHtml(proposal: any, bdmName: string): string {
  return wrapEmail(`
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:18px">Proposal Awaiting Approval</h2>
    <p style="margin:0 0 16px;color:#374151">A proposal submitted by <strong>${bdmName}</strong> requires your review:</p>
    <div style="background:#f4f4f5;border-radius:12px;padding:16px;margin:0 0 20px">
      <p style="margin:4px 0"><strong>Title:</strong> ${proposal.title}</p>
      <p style="margin:4px 0"><strong>Client:</strong> ${proposal.client?.name ?? ''}</p>
      <p style="margin:4px 0"><strong>Account Manager:</strong> ${bdmName}</p>
    </div>
    <a href="${APP_URL}" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px">
      Review in Service Operations Tracker
    </a>
  `);
}

function buildBdmStatusEmail(proposal: any, status: 'approved' | 'queried', adminNotes?: string): string {
  const colour = status === 'approved' ? '#16a34a' : '#d97706';
  const heading = status === 'approved' ? '✅ Proposal Approved' : '❓ Proposal Queried';
  const body = status === 'approved'
    ? `Your proposal "<strong>${proposal.title}</strong>" has been approved and is ready to send to the client.`
    : `Your proposal "<strong>${proposal.title}</strong>" has been queried — please review the notes and update accordingly.`;
  const notesHtml = adminNotes
    ? `<div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px;margin:12px 0"><strong>Admin Notes:</strong><br>${adminNotes}</div>`
    : '';
  return wrapEmail(`
    <h2 style="margin:0 0 8px;color:${colour};font-size:18px">${heading}</h2>
    <p style="margin:0 0 16px;color:#374151">${body}</p>
    ${notesHtml}
    <a href="${APP_URL}" style="display:inline-block;background:${colour};color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px">
      Open Service Operations Tracker
    </a>
  `);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/** GET / — List proposals. Account Managers see their own; admins see all. */
router.get('/', async (req: any, res: Response): Promise<any> => {
  if (!isBdmOrAdmin(req.user.role)) return res.status(403).json({ error: 'Account Manager or admin access required' });
  try {
    const where = req.user.role === 'admin' ? {} : { bdmId: req.user.id };
    const proposals = await withRetry(() =>
      prisma.proposal.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          client: { select: { id: true, name: true, contactName: true, email: true } },
          bdm: { select: { id: true, displayName: true, email: true } },
          approvedBy: { select: { displayName: true } },
          assignees: { select: { id: true, displayName: true, email: true, role: true } },
        },
      })
    );
    res.json(proposals);
  } catch (error) {
    console.error('[Proposals] List error:', error);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

/** GET /:id — Full proposal details. */
router.get('/:id', async (req: any, res: Response): Promise<any> => {
  if (!isBdmOrAdmin(req.user.role)) return res.status(403).json({ error: 'Account Manager or admin access required' });
  try {
    const proposal = await withRetry(() =>
      prisma.proposal.findUnique({
        where: { id: req.params.id },
        include: {
          client: true,
          bdm: { select: { id: true, displayName: true, email: true } },
          approvedBy: { select: { displayName: true, email: true } },
          assignees: { select: { id: true, displayName: true, email: true, role: true } },
        },
      })
    );
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (!['admin', 'user'].includes(req.user.role) && proposal.bdmId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(proposal);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch proposal' });
  }
});

/** POST / — Create a draft proposal. Account Manager or admin. */
router.post('/', async (req: any, res: Response): Promise<any> => {
  if (!isBdmOrAdmin(req.user.role)) return res.status(403).json({ error: 'Account Manager or admin access required' });
  try {
    const { title, clientId, message, signature, products, expiresAt, assigneeIds, ...rest } = req.body;
    if (!title || !clientId) return res.status(400).json({ error: 'title and clientId are required' });

    const isCreatingAdmin = ['admin', 'user'].includes(req.user.role);
    const docFields = pickDocFields(rest);
    const proposal = await withRetry(() =>
      prisma.proposal.create({
        data: {
          title,
          clientId,
          bdmId: req.user.id,
          // Admin proposals are auto-approved — no Account Manager submit handoff needed
          status: isCreatingAdmin ? 'approved' : 'draft',
          approvedById: isCreatingAdmin ? req.user.id : undefined,
          message: message ?? null,
          signature: signature ?? null,
          products: products ?? [],
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          ...docFields,
          assignees: Array.isArray(assigneeIds) && assigneeIds.length
            ? { connect: assigneeIds.map((id: string) => ({ id })) }
            : undefined,
        },
        include: {
          client: { select: { id: true, name: true, contactName: true, email: true } },
          bdm: { select: { id: true, displayName: true, email: true } },
          assignees: { select: { id: true, displayName: true, email: true, role: true } },
        },
      })
    );
    res.json(proposal);
  } catch (error) {
    console.error('[Proposals] Create error:', error);
    res.status(500).json({ error: 'Failed to create proposal' });
  }
});

/** PUT /:id — Edit a draft proposal. Account Manager can only edit their own drafts. */
router.put('/:id', async (req: any, res: Response): Promise<any> => {
  if (!isBdmOrAdmin(req.user.role)) return res.status(403).json({ error: 'Account Manager or admin access required' });
  try {
    const existing = await withRetry(() => prisma.proposal.findUnique({ where: { id: req.params.id } }));
    if (!existing) return res.status(404).json({ error: 'Proposal not found' });
    if (!['admin', 'user'].includes(req.user.role) && existing.bdmId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    if (!['admin', 'user'].includes(req.user.role) && existing.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft proposals can be edited' });
    }

    const { title, clientId, message, signature, products, expiresAt, assigneeIds, ...rest } = req.body;
    const updateData: Record<string, any> = {};
    if (title !== undefined) updateData.title = title;
    if (clientId !== undefined) updateData.clientId = clientId;
    if (message !== undefined) updateData.message = message;
    if (signature !== undefined) updateData.signature = signature;
    if (products !== undefined) updateData.products = products;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (assigneeIds !== undefined) {
      updateData.assignees = { set: (Array.isArray(assigneeIds) ? assigneeIds : []).map((id: string) => ({ id })) };
    }
    Object.assign(updateData, pickDocFields(rest));

    const updated = await withRetry(() =>
      prisma.proposal.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          client: { select: { id: true, name: true, contactName: true, email: true } },
          bdm: { select: { id: true, displayName: true, email: true } },
          assignees: { select: { id: true, displayName: true, email: true, role: true } },
        },
      })
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update proposal' });
  }
});

/** DELETE /:id — Delete a proposal. Account Manager: own drafts only. Admin: any. */
router.delete('/:id', async (req: any, res: Response): Promise<any> => {
  if (!isBdmOrAdmin(req.user.role)) return res.status(403).json({ error: 'Account Manager or admin access required' });
  try {
    const existing = await withRetry(() => prisma.proposal.findUnique({ where: { id: req.params.id } }));
    if (!existing) return res.status(404).json({ error: 'Proposal not found' });
    if (!['admin', 'user'].includes(req.user.role) && existing.bdmId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    if (!['admin', 'user'].includes(req.user.role) && existing.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft proposals can be deleted' });
    }
    await withRetry(() => prisma.proposal.delete({ where: { id: req.params.id } }));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete proposal' });
  }
});

/** POST /:id/submit — Account Manager submits proposal for admin approval. Emails all admins. */
router.post('/:id/submit', async (req: any, res: Response): Promise<any> => {
  if (req.user.role !== 'bdm') return res.status(403).json({ error: 'Account Manager access required' });
  try {
    const proposal = await withRetry(() =>
      prisma.proposal.findUnique({ where: { id: req.params.id }, include: { client: true, bdm: true } })
    );
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.bdmId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    if (proposal.status !== 'draft') return res.status(400).json({ error: 'Only draft proposals can be submitted' });

    await withRetry(() =>
      prisma.proposal.update({ where: { id: req.params.id }, data: { status: 'pending_approval' } })
    );

    // Email all admins
    const admins = await withRetry(() =>
      prisma.user.findMany({ where: { role: 'admin' }, select: { email: true } })
    );
    for (const admin of admins) {
      try {
        await sendEmail({
          to: admin.email,
          subject: `Proposal for Review: "${proposal.title}" — ${proposal.client?.name ?? ''}`,
          html: buildAdminNotificationHtml(proposal, proposal.bdm?.displayName ?? req.user.displayName),
        });
      } catch (e) {
        console.error('[Proposals] Failed to email admin:', e);
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit proposal' });
  }
});

/** POST /:id/approve — Admin approves proposal. Emails Account Manager. */
router.post('/:id/approve', async (req: any, res: Response): Promise<any> => {
  if (!['admin', 'user'].includes(req.user.role)) return res.status(403).json({ error: 'Admin access required' });
  try {
    const proposal = await withRetry(() =>
      prisma.proposal.findUnique({ where: { id: req.params.id }, include: { bdm: true } })
    );
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.status !== 'pending_approval') return res.status(400).json({ error: 'Only pending proposals can be approved' });

    await withRetry(() =>
      prisma.proposal.update({
        where: { id: req.params.id },
        data: { status: 'approved', approvedById: req.user.id, adminNotes: req.body.adminNotes ?? null },
      })
    );

    if (proposal.bdm?.email) {
      try {
        await sendEmail({
          to: proposal.bdm.email,
          subject: `Your proposal "${proposal.title}" has been approved`,
          html: buildBdmStatusEmail(proposal, 'approved'),
        });
      } catch (e) {
        console.error('[Proposals] Failed to email Account Manager on approval:', e);
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve proposal' });
  }
});

/** POST /:id/query — Admin queries proposal. Emails Account Manager with notes. */
router.post('/:id/query', async (req: any, res: Response): Promise<any> => {
  if (!['admin', 'user'].includes(req.user.role)) return res.status(403).json({ error: 'Admin access required' });
  try {
    const proposal = await withRetry(() =>
      prisma.proposal.findUnique({ where: { id: req.params.id }, include: { bdm: true } })
    );
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (!['pending_approval', 'approved'].includes(proposal.status)) {
      return res.status(400).json({ error: 'Proposal cannot be queried at this stage' });
    }

    const { adminNotes } = req.body;
    await withRetry(() =>
      prisma.proposal.update({
        where: { id: req.params.id },
        data: { status: 'queried', adminNotes: adminNotes ?? null },
      })
    );

    if (proposal.bdm?.email) {
      try {
        await sendEmail({
          to: proposal.bdm.email,
          subject: `Query on your proposal "${proposal.title}"`,
          html: buildBdmStatusEmail(proposal, 'queried', adminNotes),
        });
      } catch (e) {
        console.error('[Proposals] Failed to email Account Manager on query:', e);
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to query proposal' });
  }
});

/** POST /:id/send — Admin or owning Account Manager sends an approved proposal to the client. */
router.post('/:id/send', async (req: any, res: Response): Promise<any> => {
  if (!isBdmOrAdmin(req.user.role)) return res.status(403).json({ error: 'Account Manager or admin access required' });
  try {
    const proposal = await withRetry(() =>
      prisma.proposal.findUnique({
        where: { id: req.params.id },
        include: {
          client: {
            include: {
              bdm:  { select: { email: true, displayName: true } },
              bdms: { where: { role: 'bdm' }, select: { email: true } },
            },
          },
          bdm: true,
          assignees: { select: { email: true } },
        },
      })
    );
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (req.user.role === 'bdm' && proposal.bdmId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    if (!['approved', 'draft'].includes(proposal.status)) return res.status(400).json({ error: 'Proposal cannot be sent at this stage' });
    if (!proposal.client?.email) return res.status(400).json({ error: 'Client has no email address' });

    // Gather attachments from named document fields
    const attachments: any[] = [];
    for (const field of DOC_FIELDS) {
      const raw = (proposal as any)[field] as string | null;
      const parsed = parseStoredDocument(raw);
      if (parsed) attachments.push(parsed);
    }

    // Build CC: client ccEmails + proposal Account Manager + proposal assignees + client Account Managers + all admins (excluding sender and client)
    const clientCc: string[] = proposal.client.ccEmails
      ? proposal.client.ccEmails.split(',').map((e: string) => e.trim()).filter(Boolean)
      : [];
    const bdmEmail = proposal.bdm?.email;
    const assigneeEmails = ((proposal as any).assignees ?? []).map((a: any) => a.email).filter(Boolean);
    const clientBdmEmails = [
      (proposal.client as any).bdm?.email,
      ...((proposal.client as any).bdms?.map((b: any) => b.email) ?? []),
    ].filter((e): e is string => !!e);
    const adminUsers = await withRetry(() =>
      prisma.user.findMany({ where: { role: 'admin' }, select: { email: true } })
    );
    const adminEmails = adminUsers.map((u: { email: string }) => u.email);
    const senderEmail = req.user.email as string;
    const clientEmail = proposal.client.email;
    const cc = [...new Set([
      ...clientCc,
      ...(bdmEmail && bdmEmail !== senderEmail ? [bdmEmail] : []),
      ...assigneeEmails.filter((e: string) => e !== senderEmail && e !== clientEmail),
      ...clientBdmEmails.filter((e: string) => e !== senderEmail && e !== clientEmail),
      ...adminEmails.filter((e: string) => e !== senderEmail && e !== clientEmail),
    ])].filter(Boolean);

    const html = buildProposalEmailHtml(proposal, proposal.client, proposal.bdm);
    const subject = req.body.subject || `Proposal from Example Company — ${proposal.title}`;

    await sendEmail({
      to: proposal.client.email,
      cc: cc.length ? cc : undefined,
      subject,
      html,
      attachments: attachments.length ? attachments : undefined,
    });

    await withRetry(() =>
      prisma.proposal.update({ where: { id: req.params.id }, data: { status: 'sent', sentAt: new Date() } })
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[Proposals] Send error:', error);
    res.status(500).json({ error: 'Failed to send proposal' });
  }
});

/** POST /:id/create-order — Create a pre-filled order from an approved/sent proposal. */
router.post('/:id/create-order', async (req: any, res: Response): Promise<any> => {
  if (!isBdmOrAdmin(req.user.role)) return res.status(403).json({ error: 'Account Manager or admin access required' });
  try {
    const proposal = await withRetry(() =>
      prisma.proposal.findUnique({ where: { id: req.params.id }, include: { client: true, bdm: true } })
    );
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (!['approved', 'sent'].includes(proposal.status)) {
      return res.status(400).json({ error: 'Order can only be created from an approved or sent proposal' });
    }
    if (!['admin', 'user'].includes(req.user.role) && proposal.bdmId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const initialStatus = await getInitialStatus();
    const proposalProducts = Array.isArray((proposal as any).products) ? (proposal as any).products : [];
    const quoteAmount = proposalProducts.reduce((s: number, p: any) => s + (p.lineTotal || 0), 0);
    const proposalDocData: Record<string, string> = {};
    for (const field of DOC_FIELDS) {
      const v = (proposal as any)[field];
      if (v) proposalDocData[field] = v;
    }
    const order = await withRetry(() =>
      prisma.order.create({
        data: {
          id: `DEMO-${Math.floor(1000 + Math.random() * 9000)}`,
          clientName: proposal.client?.name ?? 'Unknown Client',
          clientId: proposal.clientId,
          licenseType: '',
          licenseCount: 1,
          products: proposalProducts,
          status: initialStatus,
          category: 'sales',
          quoteAmount: quoteAmount || undefined,
          assignedTo: proposal.bdm?.displayName ?? 'Unassigned',
          assignedEmail: proposal.bdm?.email ?? '',
          createdBy: req.user.id,
          bdmId: proposal.bdmId,
          notes: `Created from proposal: ${proposal.title}`,
          ...proposalDocData,
        },
        include: { client: true },
      })
    );

    await withRetry(() =>
      prisma.orderStepAudit.create({ data: { orderId: order.dbId, step: order.status } })
    );

    res.json(order);
  } catch (error) {
    console.error('[Proposals] Create order error:', error);
    res.status(500).json({ error: 'Failed to create order from proposal' });
  }
});

export default router;
