/**
 * cron.ts — Scheduled Jobs (SLA Reminder Engine)
 *
 * Runs every 12 hours. All day thresholds are in BUSINESS DAYS (Mon–Fri).
 *
 * Internal SLA reminders (assigned users):
 *   2 business days  → reminder email
 *   5 business days  → escalation email
 *   5+ business days → daily escalation (once per business day)
 *
 * Client POP reminders (step must have clientReminderEnabled = true):
 *   5 business days  → warning: quote expires in 2 days, send POP
 *   7 business days  → final warning: last day to send POP
 *   8 business days  → expired: order auto-moved to quote_expired,
 *                      client notified, assigned users notified
 */

import { prisma, withRetry } from './db.js';
import { sendEmail } from './smtp.js';
import { calculateBusinessHours } from './businessTime.js';
import { wrapEmail } from './lib/emailTemplate.js';

const CRON_INTERVAL_MS = 1000 * 60 * 60 * 12; // 12 hours
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

// ─── Business Day Helper ──────────────────────────────────────────────────────

/**
 * Counts weekdays (Mon–Fri) that have fully elapsed since startDate.
 * The start day itself is not counted; today is counted only if it has started.
 */
function businessDaysSince(startDate: Date, now: Date = new Date()): number {
  let count = 0;
  const d = new Date(startDate);
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function isTodayBusinessDay(now: Date = new Date()): boolean {
  const day = now.getDay();
  return day !== 0 && day !== 6;
}

// ─── Internal SLA Email Templates ────────────────────────────────────────────

function buildTwoDayReminderEmail(orderId: string, clientName: string, stepLabel: string): string {
  return wrapEmail(`
    <h2 style="margin:0 0 8px;color:#d97706;font-size:18px">📋 Reminder</h2>
    <p style="margin:0 0 16px;color:#374151">An order has been waiting for <strong>2 business days</strong>:</p>
    <div style="background:#fefce8;border:1px solid #fef08a;border-radius:12px;padding:16px;margin:0 0 20px">
      <p style="margin:4px 0"><strong>Order:</strong> ${orderId}</p>
      <p style="margin:4px 0"><strong>Client:</strong> ${clientName}</p>
      <p style="margin:4px 0"><strong>Stage:</strong> ${stepLabel}</p>
    </div>
    <a href="${APP_URL}" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px">
      Open Service Operations Tracker
    </a>
  `);
}

function buildFiveDayEscalationEmail(orderId: string, clientName: string, stepLabel: string, bdays: number): string {
  return wrapEmail(`
    <h2 style="margin:0 0 8px;color:#dc2626;font-size:18px">⚠️ Escalation Notice</h2>
    <p style="margin:0 0 16px;color:#374151">The following order has been stuck for <strong>${bdays} business days</strong>:</p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:0 0 16px">
      <p style="margin:4px 0"><strong>Order:</strong> ${orderId}</p>
      <p style="margin:4px 0"><strong>Client:</strong> ${clientName}</p>
      <p style="margin:4px 0"><strong>Stage:</strong> ${stepLabel}</p>
      <p style="margin:4px 0"><strong>Business Days Waiting:</strong> ${bdays}</p>
    </div>
    <p style="margin:0 0 20px;color:#dc2626;font-weight:bold">Please take action immediately.</p>
    <a href="${APP_URL}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px">
      Open Service Operations Tracker
    </a>
  `);
}

function buildDailyEscalationEmail(orderId: string, clientName: string, stepLabel: string, bdays: number): string {
  return wrapEmail(`
    <h2 style="margin:0 0 8px;color:#b91c1c;font-size:18px">🚨 Daily Escalation Reminder</h2>
    <p style="margin:0 0 16px;color:#374151">The following order is still waiting after <strong>${bdays} business days</strong>:</p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:0 0 20px">
      <p style="margin:4px 0"><strong>Order:</strong> ${orderId}</p>
      <p style="margin:4px 0"><strong>Client:</strong> ${clientName}</p>
      <p style="margin:4px 0"><strong>Stage:</strong> ${stepLabel}</p>
    </div>
    <a href="${APP_URL}" style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px">
      Take Action Now
    </a>
  `);
}

// ─── Client POP Reminder Email Templates ─────────────────────────────────────
// Edit these templates to customise the emails sent to clients.

function formatZAR(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
}

function buildProductListHtml(products: any[], quoteAmount?: number): string {
  if (!products || products.length === 0) {
    return quoteAmount != null
      ? `<p style="font-size:14px;color:#374151;margin:0">Total: <strong>${formatZAR(quoteAmount)}</strong></p>`
      : '';
  }

  const rows = products
    .map(p => {
      const lineTotal = p.lineTotal ?? (p.unitCost * p.quantity);
      return `<tr>
        <td style="padding:6px 12px 6px 0;font-size:14px;color:#374151;white-space:nowrap">${p.quantity}&times;</td>
        <td style="padding:6px 8px 6px 0;font-size:14px;color:#374151;width:100%">${p.name}</td>
        <td style="padding:6px 0 6px 8px;font-size:14px;color:#374151;white-space:nowrap;text-align:right">${formatZAR(p.unitCost)} ea</td>
        <td style="padding:6px 0 6px 12px;font-size:14px;color:#111827;font-weight:600;white-space:nowrap;text-align:right">${formatZAR(lineTotal)}</td>
      </tr>`;
    })
    .join('');

  const total = quoteAmount ?? products.reduce((sum, p) => sum + (p.lineTotal ?? (p.unitCost * p.quantity)), 0);

  return `
    <table style="border-collapse:collapse;width:100%;margin:4px 0">
      <thead>
        <tr style="border-bottom:1px solid #e5e7eb">
          <th style="padding:4px 12px 8px 0;font-size:11px;font-weight:700;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.05em">Qty</th>
          <th style="padding:4px 8px 8px 0;font-size:11px;font-weight:700;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.05em">Description</th>
          <th style="padding:4px 0 8px 8px;font-size:11px;font-weight:700;color:#6b7280;text-align:right;text-transform:uppercase;letter-spacing:0.05em">Unit Price</th>
          <th style="padding:4px 0 8px 12px;font-size:11px;font-weight:700;color:#6b7280;text-align:right;text-transform:uppercase;letter-spacing:0.05em">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr style="border-top:2px solid #e5e7eb">
          <td colspan="3" style="padding:10px 8px 4px 0;font-size:14px;font-weight:700;color:#111827;text-align:right">Order Total:</td>
          <td style="padding:10px 12px 4px;font-size:15px;font-weight:800;color:#111827;text-align:right">${formatZAR(total)}</td>
        </tr>
      </tfoot>
    </table>`;
}

function buildClientDay5Email(clientName: string, products: any[], quoteAmount?: number): string {
  return wrapEmail(`
    <p style="margin:0 0 16px">Dear ${clientName},</p>
    <p style="margin:0 0 16px">
      Thank you for your interest in Example Company. We would like to remind you that your quote
      is set to expire in <strong>2 business days</strong>.
    </p>
    <p style="margin:0 0 16px">
      To secure your order please send through your <strong>Proof of Payment (POP)</strong> at your
      earliest convenience. Your quoted items are listed below for reference:
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:0 0 16px">
      ${buildProductListHtml(products, quoteAmount)}
    </div>
    <p style="margin:0 0 16px">
      Should you have any questions or need assistance please don't hesitate to reply to this email.
    </p>
    <p style="margin:0">We look forward to hearing from you.</p>
  `);
}

function buildClientDay7Email(clientName: string, products: any[], quoteAmount?: number): string {
  return wrapEmail(`
    <p style="margin:0 0 16px">Dear ${clientName},</p>
    <p style="margin:0 0 16px">
      We wanted to reach out one last time as your quote is expiring <strong>today</strong> and we
      don't want you to miss out.
    </p>
    <p style="margin:0 0 16px">
      To keep your order active please send your <strong>Proof of Payment (POP)</strong> through to
      us today. Your quoted items are:
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:0 0 16px">
      ${buildProductListHtml(products, quoteAmount)}
    </div>
    <p style="margin:0 0 16px">
      If we don't receive payment today your quote will unfortunately lapse and a new one will need
      to be requested. Please note that pricing may be subject to change at that point.
    </p>
    <p style="margin:0">Please reply to this email or give us a call if you need any help at all.</p>
  `);
}

function buildClientExpiredEmail(clientName: string, products: any[], quoteAmount?: number): string {
  return wrapEmail(`
    <p style="margin:0 0 16px">Dear ${clientName},</p>
    <p style="margin:0 0 16px">
      We regret to inform you that your quote has now expired as we did not receive your
      Proof of Payment within the required timeframe.
    </p>
    <p style="margin:0 0 16px">Your quoted items were:</p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:0 0 16px">
      ${buildProductListHtml(products, quoteAmount)}
    </div>
    <p style="margin:0 0 16px">
      If you're still interested in proceeding we'd love to assist you. Please reply to this email
      and we will arrange a new quote for you. Please note that pricing may be subject to change.
    </p>
    <p style="margin:0">Thank you for considering Example Company. We hope to work with you soon.</p>
  `);
}


// ─── Cron Logic ───────────────────────────────────────────────────────────────

async function runSlaCheck(): Promise<void> {
  console.log('[CRON] Running SLA reminder check...');
  const now = new Date();

  const allSteps = await withRetry(() =>
    prisma.workflowStep.findMany({ orderBy: { position: 'asc' } })
  );

  const stepLabelMap = Object.fromEntries(allSteps.map((s: any) => [s.id, s.label]));

  // ── Internal SLA Reminders ────────────────────────────────────────────────
  // Only intermediate, internal, non-client-reminder steps

  const internalTrackableIds = (allSteps.length > 2 ? allSteps.slice(1, -1) : allSteps)
    .filter((s: any) => !s.isExternalTeam)
    .map((s: any) => s.id);

  if (internalTrackableIds.length > 0) {
    const activeAudits = await withRetry(() =>
      prisma.orderStepAudit.findMany({
        where: { completedAt: null, step: { in: internalTrackableIds } },
        include: { order: true },
      })
    );

    for (const audit of activeAudits) {
      const bdays = businessDaysSince(new Date(audit.startedAt), now);
      const lastDailyMs = audit.lastDailyReminderSentAt
        ? new Date(audit.lastDailyReminderSentAt).getTime()
        : 0;

      const shouldSend2Days = bdays >= 2 && !audit.reminder2DaysSent;
      const shouldSend5Days = bdays >= 5 && !audit.reminder5DaysSent;
      // Daily only on business days, and only once per ~23h
      const shouldSendDaily =
        bdays >= 5 &&
        isTodayBusinessDay(now) &&
        now.getTime() - lastDailyMs > 1000 * 3600 * 23;

      if (!shouldSend2Days && !shouldSend5Days && !shouldSendDaily) continue;

      const stepLabel = stepLabelMap[audit.step] ?? audit.step;
      const { id: orderId, clientName } = audit.order;

      const assignments = await withRetry(() =>
        prisma.stepAssignment.findMany({
          where: { step: audit.step, notifyOnSLA: true },
          include: { user: true },
        })
      );

      const slaRecipients = assignments.map((a: any) => a.user?.email).filter((e: any): e is string => !!e);
      if (slaRecipients.length > 0) {
        try {
          if (shouldSendDaily && !shouldSend5Days) {
            await sendEmail({
              to: slaRecipients,
              subject: `DAILY ESCALATION: Order ${orderId} still stuck on "${stepLabel}"`,
              html: buildDailyEscalationEmail(orderId, clientName, stepLabel, bdays),
            });
          } else if (shouldSend5Days) {
            await sendEmail({
              to: slaRecipients,
              subject: `ESCALATION: Order ${orderId} stuck on "${stepLabel}" for ${bdays} business days`,
              html: buildFiveDayEscalationEmail(orderId, clientName, stepLabel, bdays),
            });
          } else if (shouldSend2Days) {
            await sendEmail({
              to: slaRecipients,
              subject: `Reminder: Order ${orderId} awaiting action on "${stepLabel}"`,
              html: buildTwoDayReminderEmail(orderId, clientName, stepLabel),
            });
          }
        } catch (err) {
          console.error(`[CRON] Failed to send internal SLA email to [${slaRecipients.join(', ')}]:`, err);
        }
      }

      const updateData: Record<string, any> = {};
      if (shouldSend5Days) { updateData.reminder5DaysSent = true; updateData.lastDailyReminderSentAt = now; }
      else if (shouldSendDaily) { updateData.lastDailyReminderSentAt = now; }
      else if (shouldSend2Days) { updateData.reminder2DaysSent = true; }

      if (Object.keys(updateData).length > 0) {
        await withRetry(() =>
          prisma.orderStepAudit.update({ where: { id: audit.id }, data: updateData })
        );
      }
    }
  }

  // ── Custom Stagnation Alerts ──────────────────────────────────────────────

  const allCustomAlerts = await withRetry(() =>
    prisma.customAlert.findMany({ include: { user: true } })
  );

  if (allCustomAlerts.length > 0) {
    const customAudits = await withRetry(() =>
      prisma.orderStepAudit.findMany({
        where: {
          completedAt: null,
          step: { in: [...new Set(allCustomAlerts.map((a: any) => a.stepId))] },
        },
        include: { order: true },
      })
    );

    for (const audit of customAudits) {
      const hoursInStep = calculateBusinessHours(new Date(audit.startedAt), now);
      const alertsForStep = allCustomAlerts.filter((a: any) => a.stepId === audit.step);
      const stepLabel = stepLabelMap[audit.step] ?? audit.step;

      for (const alert of alertsForStep) {
        if (hoursInStep < alert.hours) continue;
        if (audit.firedCustomAlerts.includes(alert.id)) continue;
        if (!alert.user?.email) continue;

        try {
          await sendEmail({
            to: alert.user.email,
            subject: `Stagnation Alert: Order ${audit.order.id} has been in "${stepLabel}" for ${Math.round(hoursInStep)} business hours`,
            html: wrapEmail(`
              <h2 style="margin:0 0 8px;color:#b91c1c;font-size:18px">⏰ Stagnation Alert</h2>
              <p style="margin:0 0 16px;color:#374151">An order has exceeded your configured threshold of <strong>${alert.hours} business hours</strong> (weekends excluded).</p>
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:0 0 20px">
                <p style="margin:4px 0"><strong>Order:</strong> ${audit.order.id}</p>
                <p style="margin:4px 0"><strong>Client:</strong> ${audit.order.clientName}</p>
                <p style="margin:4px 0"><strong>Stage:</strong> ${stepLabel}</p>
                <p style="margin:4px 0"><strong>Time in stage:</strong> ${Math.round(hoursInStep)} business hours</p>
              </div>
              <a href="${APP_URL}?order=${audit.order.dbId}" style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px">
                Open Order
              </a>
            `),
          });
          await withRetry(() =>
            prisma.orderStepAudit.update({
              where: { id: audit.id },
              data: { firedCustomAlerts: { push: alert.id } },
            })
          );
        } catch (err) {
          console.error(`[CRON] Failed to send custom alert for order ${audit.order.id}:`, err);
        }
      }
    }
  }

  // ── Date-Range SLA Rules ──────────────────────────────────────────────────
  // Fires when an order has been in a step longer than a rule's threshold,
  // where the rule's day-of-month range covers the day the order entered the step.

  const allDateRangeRules = await withRetry(() =>
    prisma.dateRangeSlaRule.findMany({ include: { user: true } })
  );

  if (allDateRangeRules.length > 0) {
    const drAudits = await withRetry(() =>
      prisma.orderStepAudit.findMany({
        where: {
          completedAt: null,
          step: { in: [...new Set(allDateRangeRules.map((r: any) => r.stepId))] },
        },
        include: { order: true },
      })
    );

    for (const audit of drAudits) {
      const entryDay = new Date(audit.startedAt).getDate(); // day of month when order entered step
      const hoursInStep = calculateBusinessHours(new Date(audit.startedAt), now);
      const rulesForStep = allDateRangeRules.filter((r: any) => r.stepId === audit.step && entryDay >= r.fromDay && entryDay <= r.toDay);
      const stepLabel = stepLabelMap[audit.step] ?? audit.step;

      for (const rule of rulesForStep) {
        if (hoursInStep < rule.hours) continue;
        const ruleKey = `drsla_${rule.id}`;
        if (audit.firedCustomAlerts.includes(ruleKey)) continue;

        // If userId is set, alert only that user; otherwise alert all assigned SLA users for the step
        const recipients: string[] = [];
        if (rule.userId && rule.user?.email) {
          recipients.push(rule.user.email);
        } else {
          const assignments = await withRetry(() =>
            prisma.stepAssignment.findMany({ where: { step: audit.step, notifyOnSLA: true }, include: { user: true } })
          );
          assignments.filter((a: any) => a.user?.email).forEach((a: any) => recipients.push(a.user.email));
        }

        for (const recipientEmail of recipients) {
          try {
            await sendEmail({
              to: recipientEmail,
              subject: `Date-Range SLA Alert: Order ${audit.order.id} exceeded threshold in "${stepLabel}"`,
              html: wrapEmail(`
                <h2 style="margin:0 0 8px;color:#b91c1c;font-size:18px">📅 Date-Range SLA Alert</h2>
                <p style="margin:0 0 16px;color:#374151">An order entered "<strong>${stepLabel}</strong>" on day <strong>${entryDay}</strong> of the month (within your rule covering days ${rule.fromDay}–${rule.toDay}), and has now exceeded the <strong>${rule.hours} business hour</strong> threshold.</p>
                <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:0 0 20px">
                  <p style="margin:4px 0"><strong>Order:</strong> ${audit.order.id}</p>
                  <p style="margin:4px 0"><strong>Client:</strong> ${audit.order.clientName}</p>
                  <p style="margin:4px 0"><strong>Stage:</strong> ${stepLabel}</p>
                  <p style="margin:4px 0"><strong>Time in stage:</strong> ${Math.round(hoursInStep)} business hours</p>
                  <p style="margin:4px 0"><strong>Rule threshold:</strong> ${rule.hours} hours (days ${rule.fromDay}–${rule.toDay})</p>
                </div>
                <a href="${APP_URL}?order=${audit.order.dbId}" style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px">Open Order</a>
              `),
            });
          } catch (err) {
            console.error(`[CRON] Failed to send date-range SLA alert for order ${audit.order.id}:`, err);
          }
        }

        try {
          await withRetry(() =>
            prisma.orderStepAudit.update({
              where: { id: audit.id },
              data: { firedCustomAlerts: { push: ruleKey } },
            })
          );
        } catch (err) {
          console.error(`[CRON] Failed to mark date-range SLA rule as fired:`, err);
        }
      }
    }
  }

  // ── Client POP Reminders ──────────────────────────────────────────────────

  const clientReminderStepIds = allSteps
    .filter((s: any) => s.clientReminderEnabled)
    .map((s: any) => s.id);

  if (clientReminderStepIds.length > 0) {
    const clientAudits = await withRetry(() =>
      prisma.orderStepAudit.findMany({
        where: { completedAt: null, step: { in: clientReminderStepIds } },
        include: { order: { include: { client: true, bdm: { select: { email: true } } } } },
      })
    );

    for (const audit of clientAudits) {
      const effectiveStart = (audit as any).clientReminderResetAt ?? audit.startedAt;
      const bdays = businessDaysSince(new Date(effectiveStart), now);
      const clientEmail = audit.order.client?.email;
      const { id: orderId, clientName } = audit.order;

      // Build CC list: client card CC emails + step-assigned users + Account Manager (if linked)
      const clientCcEmails = (audit.order.client as any)?.ccEmails
        ? (audit.order.client as any).ccEmails.split(',').map((e: string) => e.trim()).filter(Boolean)
        : [];
      const stepAssignments = await withRetry(() =>
        prisma.stepAssignment.findMany({
          where: { step: audit.step },
          include: { user: true },
        })
      );
      const assignedEmails = stepAssignments
        .filter((a: any) => a.user?.email)
        .map((a: any) => a.user.email as string);
      const bdmEmail = (audit.order as any).bdm?.email;
      const ccEmails = [...new Set([...clientCcEmails, ...assignedEmails, ...(bdmEmail ? [bdmEmail] : [])])];

      // Day 8: auto-expire
      if (bdays >= 8 && !(audit as any).clientExpiredSent) {
        try {
          // Close audit + expire order atomically — DB must be correct before emails go out
          await withRetry(() =>
            prisma.$transaction([
              prisma.orderStepAudit.update({
                where: { id: audit.id },
                data: { completedAt: now, clientExpiredSent: true } as any,
              }),
              prisma.order.update({
                where: { dbId: audit.orderId },
                data: { status: 'quote_expired' },
              }),
            ])
          );
          console.log(`[CRON] ✓ Auto-expired order ${orderId}`);

          // Email client with assigned users CC'd (best-effort)
          if (clientEmail) {
            try {
              await sendEmail({
                to: clientEmail,
                cc: ccEmails.length ? ccEmails : undefined,
                subject: `Your quote with Example Company has expired`,
                html: buildClientExpiredEmail(clientName, (audit.order as any).products ?? [], (audit.order as any).quoteAmount),
              });
            } catch (e) {
              console.error(`[CRON] Failed to send expiry email to client for order ${orderId}:`, e);
            }
          }

        } catch (err) {
          console.error(`[CRON] Failed to expire order ${orderId}:`, err);
        }
        continue; // skip day 5/7 checks for this audit
      }

      // Day 7: final warning to client, assigned users CC'd
      if (bdays >= 7 && !(audit as any).clientReminder7Sent && clientEmail) {
        try {
          await sendEmail({
            to: clientEmail,
            cc: ccEmails.length ? ccEmails : undefined,
            subject: `Last chance — your Example Company quote expires today`,
            html: buildClientDay7Email(clientName, (audit.order as any).products ?? [], (audit.order as any).quoteAmount),
          });
          await withRetry(() =>
            prisma.orderStepAudit.update({
              where: { id: audit.id },
              data: { clientReminder7Sent: true } as any,
            })
          );
          console.log(`[CRON] ✓ Sent day-7 client reminder for order ${orderId}`);
        } catch (err) {
          console.error(`[CRON] Failed to send day-7 reminder for order ${orderId}:`, err);
        }
        continue;
      }

      // Day 5: expiry warning to client, assigned users CC'd
      if (bdays >= 5 && !(audit as any).clientReminder5Sent && clientEmail) {
        try {
          await sendEmail({
            to: clientEmail,
            cc: ccEmails.length ? ccEmails : undefined,
            subject: `Friendly reminder — your Example Company quote expires soon`,
            html: buildClientDay5Email(clientName, (audit.order as any).products ?? [], (audit.order as any).quoteAmount),
          });
          await withRetry(() =>
            prisma.orderStepAudit.update({
              where: { id: audit.id },
              data: { clientReminder5Sent: true } as any,
            })
          );
          console.log(`[CRON] ✓ Sent day-5 client reminder for order ${orderId}`);
        } catch (err) {
          console.error(`[CRON] Failed to send day-5 reminder for order ${orderId}:`, err);
        }
      }
    }
  }

  console.log('[CRON] SLA check complete.');
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export function startCron(): void {
  runSlaCheck().catch(e => console.error('[CRON] Initial run failed:', e));
  setInterval(() => {
    runSlaCheck().catch(e => console.error('[CRON] Run failed:', e));
  }, CRON_INTERVAL_MS);
}
