/**
 * budget-quotes.ts — Budget Quote Routes
 *
 * Full approval workflow mirroring proposals:
 *   draft → pending_approval → approved/queried → sent → accepted/declined → converted
 *
 * Endpoints:
 *   GET    /                      — list all budget quotes
 *   GET    /:id                   — single quote with full detail
 *   POST   /                      — create a new draft quote
 *   PUT    /:id                   — update a draft or queried quote
 *   DELETE /:id                   — delete (admin: any; others: own draft only)
 *   POST   /:id/submit            — draft → pending_approval
 *   POST   /:id/approve           — pending_approval → approved (admin/user)
 *   POST   /:id/query             — pending_approval → queried (admin/user)
 *   POST   /:id/status            — send (approved→sent), accept (sent→accepted), decline (sent→declined)
 *   POST   /:id/convert-to-order  — accepted → converted + creates order (admin/user only)
 */

import { Router, Response } from 'express';
import { prisma, withRetry } from '../db.js';
import { authMiddleware } from './auth.js';
import { getInitialStatus } from '../workflow.js';
import { sendEmail } from '../smtp.js';
import { wrapEmail } from '../lib/emailTemplate.js';

const router = Router();
router.use(authMiddleware);

const INCLUDE = {
  client: {
    select: {
      id: true, name: true, contactName: true, email: true, ccEmails: true,
      bdm:  { select: { email: true, displayName: true } },
      bdms: { where: { role: 'bdm' }, select: { email: true, displayName: true } },
    },
  },
  bdm:      { select: { id: true, displayName: true, email: true } },
  creator:  { select: { displayName: true } },
  assignees: { select: { id: true, displayName: true, email: true, role: true } },
};

// ─── Email helpers ────────────────────────────────────────────────────────────

// Matches wrapEmail()'s base font — restated explicitly here (and on the message
// wrapper below) because Outlook and other email clients don't reliably inherit
// font-family from a parent <table> several levels up, which otherwise left the
// free-form "message to client" text rendering in a different font to the greeting.
const EMAIL_BODY_FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#374151;line-height:1.6";

async function getAdminEmails(): Promise<string[]> {
  const admins = await withRetry(() =>
    prisma.user.findMany({ where: { role: { in: ['admin', 'user'] } }, select: { email: true } })
  );
  return admins.map((u: any) => u.email);
}

async function sendBudgetQuoteEmail(quote: any, customSubject?: string): Promise<void> {
  const clientEmail = quote.client?.email;
  if (!clientEmail) return;

  const contactName = quote.client?.contactName || quote.clientName;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);

  const products: any[] = Array.isArray(quote.products) ? quote.products : [];

  const rows = products.map((p: any) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px">${p.name}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;text-align:center">${p.quantity}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;text-align:right">${fmt(p.unitCost)}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;font-weight:600;text-align:right">${fmt(p.lineTotal)}</td>
    </tr>`).join('');

  const expiryLine = quote.expiresAt
    ? `<p style="margin:0 0 8px;color:#6b7280;font-size:14px">
         <strong>Valid until:</strong> ${new Date(quote.expiresAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
       </p>`
    : '';

  const rawMsg = quote.message ?? '';
  const messageSection = rawMsg
    ? `<div style="margin:0 0 24px;${EMAIL_BODY_FONT}">${rawMsg.trim().startsWith('<') ? rawMsg : rawMsg.split('\n').map((l: string) => `<p style="margin:0 0 12px">${l || '&nbsp;'}</p>`).join('')}</div>`
    : `<p style="margin:0 0 24px;${EMAIL_BODY_FONT}">Thank you for your interest. Please find below your budgetary quote from Example Company.</p>`;

  const rawSig = quote.signature ?? '';
  const signatureSection = rawSig
    ? `<div style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb">${rawSig}</div>`
    : `<p style="margin:24px 0 0;color:#374151;font-size:15px;line-height:1.6">Warm regards,<br/><strong>Example Company Team</strong></p>`;

  const body = `
    <p style="margin:0 0 16px;${EMAIL_BODY_FONT}">Dear ${contactName},</p>
    ${messageSection}
    ${quote.title ? `<p style="margin:0 0 24px;color:#6b7280;font-size:15px;font-style:italic">${quote.title}</p>` : ''}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px">
      <thead>
        <tr style="background:#1e3a5f">
          <th style="padding:10px 16px;text-align:left;color:#fff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Product / Service</th>
          <th style="padding:10px 16px;text-align:center;color:#fff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Qty</th>
          <th style="padding:10px 16px;text-align:right;color:#fff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Unit Price</th>
          <th style="padding:10px 16px;text-align:right;color:#fff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f3f4f6">
          <td colspan="3" style="padding:12px 16px;font-size:14px;font-weight:700;color:#374151;text-align:right">Grand Total (excl. VAT)</td>
          <td style="padding:12px 16px;font-size:16px;font-weight:800;color:#1e3a5f;text-align:right">${fmt(quote.quoteAmount)}</td>
        </tr>
      </tfoot>
    </table>
    ${expiryLine}
    ${signatureSection}`;

  const ccEmails = [
    quote.bdm?.email,
    quote.client?.bdm?.email,
    ...((quote.client?.bdms ?? []).map((b: any) => b.email)),
    ...((quote.client?.ccEmails ?? '').split(',').map((e: string) => e.trim()).filter(Boolean)),
    ...(quote.assignees ?? []).map((a: any) => a.email),
  ].filter((e: any): e is string => !!e && e !== clientEmail);
  const cc = [...new Set(ccEmails)];

  const attachments: any[] = [];
  const docFields = ['technicalQuoteLink', 'salesQuoteLink', 'proformaInvoiceLink', 'onsiteQuoteLink', 'customerQuoteLink'];
  for (const field of docFields) {
    const raw = quote[field] as string | undefined;
    if (!raw) continue;
    try {
      const [filename, dataUri] = raw.split('$$$');
      if (dataUri) {
        const [meta, base64] = dataUri.split(',');
        const contentType = meta.replace('data:', '').replace(';base64', '');
        attachments.push({ filename, content: Buffer.from(base64, 'base64'), contentType });
      }
    } catch { /* ignore bad attachment */ }
  }

  await sendEmail({
    to: clientEmail,
    cc: cc.length ? cc : undefined,
    subject: customSubject || `Budget Quote for ${quote.clientName}`,
    html: wrapEmail(body),
    attachments: attachments.length ? attachments : undefined,
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get('/', async (req: any, res: Response) => {
  try {
    const where = req.user.role === 'bdm'
      ? { OR: [{ createdBy: req.user.id }, { bdmId: req.user.id }] }
      : {};
    const quotes = await withRetry(() =>
      prisma.budgetQuote.findMany({ where, orderBy: { updatedAt: 'desc' }, include: INCLUDE })
    );
    res.json(quotes);
  } catch (error) {
    console.error('[BudgetQuotes] List error:', error);
    res.status(500).json({ error: 'Failed to fetch budget quotes' });
  }
});

router.get('/:id', async (req: any, res: Response): Promise<any> => {
  try {
    const quote = await withRetry(() =>
      prisma.budgetQuote.findUnique({ where: { id: req.params.id }, include: INCLUDE })
    );
    if (!quote) return res.status(404).json({ error: 'Budget quote not found' });
    res.json(quote);
  } catch (error) {
    console.error('[BudgetQuotes] Get error:', error);
    res.status(500).json({ error: 'Failed to fetch budget quote' });
  }
});

router.post('/', async (req: any, res: Response): Promise<any> => {
  if (!['admin', 'bdm', 'user'].includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
  try {
    const {
      clientId, title, products, notes, message, signature, expiresAt, bdmId, assigneeIds,
      technicalQuoteLink, salesQuoteLink, proformaInvoiceLink, onsiteQuoteLink, customerQuoteLink,
    } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });

    const client = await withRetry(() => prisma.client.findUnique({ where: { id: clientId } }));
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const productList = Array.isArray(products) ? products : [];
    const quoteAmount = productList.reduce((s: number, p: any) => s + (p.lineTotal || 0), 0);

    let quoteNumber = '';
    for (let i = 0; i < 10; i++) {
      quoteNumber = `BQ-${Math.floor(1000 + Math.random() * 9000)}`;
      const existing = await withRetry(() => prisma.budgetQuote.findUnique({ where: { quoteNumber } }));
      if (!existing) break;
    }

    const assignees = Array.isArray(assigneeIds) && assigneeIds.length > 0
      ? { connect: assigneeIds.map((id: string) => ({ id })) }
      : undefined;

    const quote = await withRetry(() =>
      prisma.budgetQuote.create({
        data: {
          quoteNumber,
          clientId,
          clientName: client.name,
          title: title?.trim() || null,
          products: productList,
          quoteAmount,
          notes: notes?.trim() || null,
          message: message || null,
          signature: signature || null,
          technicalQuoteLink: technicalQuoteLink ?? null,
          salesQuoteLink: salesQuoteLink ?? null,
          proformaInvoiceLink: proformaInvoiceLink ?? null,
          onsiteQuoteLink: onsiteQuoteLink ?? null,
          customerQuoteLink: customerQuoteLink ?? null,
          bdmId: bdmId ?? null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          createdBy: req.user.id,
          ...(assignees ? { assignees } : {}),
        },
        include: INCLUDE,
      })
    );

    res.json(quote);
  } catch (error) {
    console.error('[BudgetQuotes] Create error:', error);
    res.status(500).json({ error: 'Failed to create budget quote' });
  }
});

router.put('/:id', async (req: any, res: Response): Promise<any> => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Read-only access' });
  try {
    const quote = await withRetry(() => prisma.budgetQuote.findUnique({ where: { id: req.params.id } }));
    if (!quote) return res.status(404).json({ error: 'Budget quote not found' });
    if (!['draft', 'queried'].includes(quote.status)) {
      return res.status(400).json({ error: 'Only draft or queried quotes can be edited' });
    }
    if (req.user.role === 'bdm' && quote.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      clientId, title, products, notes, message, signature, expiresAt, bdmId, assigneeIds,
      technicalQuoteLink, salesQuoteLink, proformaInvoiceLink, onsiteQuoteLink, customerQuoteLink,
    } = req.body;
    const data: any = {};

    if (clientId !== undefined && clientId !== quote.clientId) {
      const client = await withRetry(() => prisma.client.findUnique({ where: { id: clientId } }));
      if (!client) return res.status(404).json({ error: 'Client not found' });
      data.clientId = clientId;
      data.clientName = client.name;
    }
    if (title !== undefined) data.title = title?.trim() || null;
    if (products !== undefined) {
      const productList = Array.isArray(products) ? products : [];
      data.products = productList;
      data.quoteAmount = productList.reduce((s: number, p: any) => s + (p.lineTotal || 0), 0);
    }
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (message !== undefined) data.message = message || null;
    if (signature !== undefined) data.signature = signature || null;
    if (technicalQuoteLink !== undefined) data.technicalQuoteLink = technicalQuoteLink ?? null;
    if (salesQuoteLink !== undefined) data.salesQuoteLink = salesQuoteLink ?? null;
    if (proformaInvoiceLink !== undefined) data.proformaInvoiceLink = proformaInvoiceLink ?? null;
    if (onsiteQuoteLink !== undefined) data.onsiteQuoteLink = onsiteQuoteLink ?? null;
    if (customerQuoteLink !== undefined) data.customerQuoteLink = customerQuoteLink ?? null;
    if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (bdmId !== undefined) data.bdmId = bdmId ?? null;

    if (Array.isArray(assigneeIds)) {
      data.assignees = { set: assigneeIds.map((id: string) => ({ id })) };
    }

    const updated = await withRetry(() =>
      prisma.budgetQuote.update({ where: { id: req.params.id }, data, include: INCLUDE })
    );
    res.json(updated);
  } catch (error) {
    console.error('[BudgetQuotes] Update error:', error);
    res.status(500).json({ error: 'Failed to update budget quote' });
  }
});

router.delete('/:id', async (req: any, res: Response): Promise<any> => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Read-only access' });
  try {
    const quote = await withRetry(() => prisma.budgetQuote.findUnique({ where: { id: req.params.id } }));
    if (!quote) return res.status(404).json({ error: 'Budget quote not found' });
    if (req.user.role !== 'admin' && req.user.role !== 'user') {
      if (quote.createdBy !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      if (quote.status !== 'draft') return res.status(400).json({ error: 'Only draft quotes can be deleted' });
    }
    await withRetry(() => prisma.budgetQuote.delete({ where: { id: req.params.id } }));
    res.json({ success: true });
  } catch (error) {
    console.error('[BudgetQuotes] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete budget quote' });
  }
});

/** POST /:id/submit — draft → pending_approval. Notifies admins/users. */
router.post('/:id/submit', async (req: any, res: Response): Promise<any> => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Read-only access' });
  try {
    const quote = await withRetry(() =>
      prisma.budgetQuote.findUnique({ where: { id: req.params.id }, include: INCLUDE })
    ) as any;
    if (!quote) return res.status(404).json({ error: 'Budget quote not found' });
    if (!['draft', 'queried'].includes(quote.status)) {
      return res.status(400).json({ error: 'Only draft or queried quotes can be submitted' });
    }

    const updated = await withRetry(() =>
      prisma.budgetQuote.update({
        where: { id: req.params.id },
        data: { status: 'pending_approval' },
        include: INCLUDE,
      })
    );

    const adminEmails = await getAdminEmails();
    if (adminEmails.length > 0) {
      sendEmail({
        to: adminEmails,
        subject: `Budget Quote ${quote.quoteNumber} submitted for approval`,
        html: wrapEmail(`
          <p style="margin:0 0 16px;color:#374151;font-size:15px">
            <strong>${req.user.displayName}</strong> has submitted budget quote
            <strong>${quote.quoteNumber}</strong>${quote.title ? ` — ${quote.title}` : ''} for approval.
          </p>
          <p style="margin:0;color:#374151;font-size:15px">Client: <strong>${quote.clientName}</strong></p>
        `),
      }).catch((err: any) => console.error('[BudgetQuotes] Submit email failed:', err));
    }

    res.json(updated);
  } catch (error) {
    console.error('[BudgetQuotes] Submit error:', error);
    res.status(500).json({ error: 'Failed to submit budget quote' });
  }
});

/** POST /:id/approve — pending_approval → approved. Admin/user only. Notifies creator. */
router.post('/:id/approve', async (req: any, res: Response): Promise<any> => {
  if (!['admin', 'user'].includes(req.user.role)) return res.status(403).json({ error: 'Admin access required' });
  try {
    const quote = await withRetry(() =>
      prisma.budgetQuote.findUnique({ where: { id: req.params.id }, include: INCLUDE })
    ) as any;
    if (!quote) return res.status(404).json({ error: 'Budget quote not found' });
    if (quote.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Only pending quotes can be approved' });
    }

    const { adminNotes } = req.body;
    const updated = await withRetry(() =>
      prisma.budgetQuote.update({
        where: { id: req.params.id },
        data: { status: 'approved', adminNotes: adminNotes?.trim() || null },
        include: INCLUDE,
      })
    );

    const creatorEmail: string | undefined = await withRetry(() =>
      prisma.user.findUnique({ where: { id: quote.createdBy }, select: { email: true } })
    ).then((u: any) => u?.email);
    const assigneeEmails = (quote.assignees ?? []).map((a: any) => a.email).filter(Boolean);
    const recipients = [...new Set([creatorEmail, ...assigneeEmails].filter(Boolean))] as string[];

    if (recipients.length > 0) {
      sendEmail({
        to: recipients,
        subject: `Budget Quote ${quote.quoteNumber} approved`,
        html: wrapEmail(`
          <p style="margin:0 0 16px;color:#374151;font-size:15px">
            Your budget quote <strong>${quote.quoteNumber}</strong>${quote.title ? ` — ${quote.title}` : ''} has been <strong style="color:#16a34a">approved</strong>.
          </p>
          ${adminNotes ? `<div style="margin:16px 0;padding:16px;background:#f0fdf4;border-radius:8px;border-left:3px solid #16a34a"><p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em">Notes from admin</p><p style="margin:0;color:#374151;font-size:14px">${adminNotes}</p></div>` : ''}
          <p style="margin:0;color:#374151;font-size:15px">You can now send this quote to the client.</p>
        `),
      }).catch((err: any) => console.error('[BudgetQuotes] Approve email failed:', err));
    }

    res.json(updated);
  } catch (error) {
    console.error('[BudgetQuotes] Approve error:', error);
    res.status(500).json({ error: 'Failed to approve budget quote' });
  }
});

/** POST /:id/query — pending_approval → queried. Admin/user only. Notifies creator. */
router.post('/:id/query', async (req: any, res: Response): Promise<any> => {
  if (!['admin', 'user'].includes(req.user.role)) return res.status(403).json({ error: 'Admin access required' });
  try {
    const quote = await withRetry(() =>
      prisma.budgetQuote.findUnique({ where: { id: req.params.id }, include: INCLUDE })
    ) as any;
    if (!quote) return res.status(404).json({ error: 'Budget quote not found' });
    if (quote.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Only pending quotes can be queried' });
    }

    const { adminNotes } = req.body;
    if (!adminNotes?.trim()) return res.status(400).json({ error: 'Query notes are required' });

    const updated = await withRetry(() =>
      prisma.budgetQuote.update({
        where: { id: req.params.id },
        data: { status: 'queried', adminNotes: adminNotes.trim() },
        include: INCLUDE,
      })
    );

    const creatorEmail: string | undefined = await withRetry(() =>
      prisma.user.findUnique({ where: { id: quote.createdBy }, select: { email: true } })
    ).then((u: any) => u?.email);
    const assigneeEmails = (quote.assignees ?? []).map((a: any) => a.email).filter(Boolean);
    const recipients = [...new Set([creatorEmail, ...assigneeEmails].filter(Boolean))] as string[];

    if (recipients.length > 0) {
      sendEmail({
        to: recipients,
        subject: `Budget Quote ${quote.quoteNumber} — clarification needed`,
        html: wrapEmail(`
          <p style="margin:0 0 16px;color:#374151;font-size:15px">
            Your budget quote <strong>${quote.quoteNumber}</strong>${quote.title ? ` — ${quote.title}` : ''} requires clarification before it can be approved.
          </p>
          <div style="margin:16px 0;padding:16px;background:#fff7ed;border-radius:8px;border-left:3px solid #f97316">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em">Query from admin</p>
            <p style="margin:0;color:#374151;font-size:14px">${adminNotes.trim()}</p>
          </div>
          <p style="margin:0;color:#374151;font-size:15px">Please update the quote and resubmit for approval.</p>
        `),
      }).catch((err: any) => console.error('[BudgetQuotes] Query email failed:', err));
    }

    res.json(updated);
  } catch (error) {
    console.error('[BudgetQuotes] Query error:', error);
    res.status(500).json({ error: 'Failed to query budget quote' });
  }
});

/** POST /:id/status — send (approved→sent), accept (sent→accepted), decline (sent→declined). */
router.post('/:id/status', async (req: any, res: Response): Promise<any> => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Read-only access' });
  try {
    const { status: newStatus, subject } = req.body;
    if (!newStatus) return res.status(400).json({ error: 'status is required' });

    const quote = await withRetry(() =>
      prisma.budgetQuote.findUnique({ where: { id: req.params.id }, include: INCLUDE })
    ) as any;
    if (!quote) return res.status(404).json({ error: 'Budget quote not found' });

    const TRANSITIONS: Record<string, string[]> = {
      draft:    ['sent'],
      approved: ['sent'],
      sent:     ['accepted', 'declined'],
    };

    const allowed = TRANSITIONS[quote.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({ error: `Cannot transition from "${quote.status}" to "${newStatus}"` });
    }

    const updated = await withRetry(() =>
      prisma.budgetQuote.update({ where: { id: req.params.id }, data: { status: newStatus }, include: INCLUDE })
    ) as any;

    if (newStatus === 'sent') {
      sendBudgetQuoteEmail(updated, subject).catch((err: any) =>
        console.error('[BudgetQuotes] Email failed:', err)
      );
    }

    res.json(updated);
  } catch (error) {
    console.error('[BudgetQuotes] Status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

/** POST /:id/convert-to-order — accepted → converted + creates order. Admin/user only. */
router.post('/:id/convert-to-order', async (req: any, res: Response): Promise<any> => {
  if (!['admin', 'user'].includes(req.user.role)) return res.status(403).json({ error: 'Admin access required' });
  try {
    const quote = await withRetry(() =>
      prisma.budgetQuote.findUnique({ where: { id: req.params.id }, include: { client: true } })
    );
    if (!quote) return res.status(404).json({ error: 'Budget quote not found' });
    if (quote.status !== 'accepted') {
      return res.status(400).json({ error: 'Only accepted budget quotes can be converted to an order' });
    }

    const initialStatus = await getInitialStatus();
    const products = Array.isArray((quote as any).products) ? (quote as any).products : [];

    const order = await withRetry(() =>
      prisma.order.create({
        data: {
          id: `DEMO-${Math.floor(1000 + Math.random() * 9000)}`,
          clientName: quote.clientName,
          clientId: quote.clientId,
          licenseType: '',
          licenseCount: 1,
          products,
          status: initialStatus,
          category: 'sales',
          quoteAmount: quote.quoteAmount || undefined,
          assignedTo: req.user.displayName ?? 'Unassigned',
          assignedEmail: req.user.email ?? '',
          createdBy: req.user.id,
          bdmId: quote.bdmId ?? undefined,
          notes: `Created from budget quote: ${quote.quoteNumber}${quote.title ? ` — ${quote.title}` : ''}`,
        },
        include: { client: true },
      })
    );

    await withRetry(() =>
      prisma.orderStepAudit.create({ data: { orderId: order.dbId, step: order.status } })
    );

    const updatedQuote = await withRetry(() =>
      prisma.budgetQuote.update({
        where: { id: req.params.id },
        data: { status: 'converted', convertedOrderId: order.id },
        include: INCLUDE,
      })
    );

    res.json({ order, budgetQuote: updatedQuote });
  } catch (error) {
    console.error('[BudgetQuotes] Convert error:', error);
    res.status(500).json({ error: 'Failed to convert budget quote to order' });
  }
});

export default router;
