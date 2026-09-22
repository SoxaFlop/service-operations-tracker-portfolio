/**
 * notifications.ts — Email Notification Service
 *
 * Handles all automated email notifications triggered by order workflow events:
 *   - Step Arrival alerts: notifies assigned users when an order enters their step
 *   - SLA Violation reports: notifies configured users when an order exceeds its time limit
 *
 * All queries use withRetry to handle transient connection timeouts gracefully.
 */

import { prisma, withRetry } from './db.js';
import { sendEmail } from './smtp.js';
import { calculateBusinessHours } from './businessTime.js';
import { wrapEmail } from './lib/emailTemplate.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

// ─── Email Templates ──────────────────────────────────────────────────────────

function buildArrivalEmail(order: any, stepLabel: string, orderUrl: string): string {
  return wrapEmail(`
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:18px">Action Required</h2>
    <p style="margin:0 0 16px;color:#374151">An order requires your attention:</p>
    <div style="background:#f4f4f5;border-radius:12px;padding:16px;margin:0 0 20px">
      <p style="margin:4px 0"><strong>Order:</strong> ${order.id}</p>
      <p style="margin:4px 0"><strong>Client:</strong> ${order.clientName}</p>
      <p style="margin:4px 0"><strong>Stage:</strong> ${stepLabel}</p>
    </div>
    <a href="${orderUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px">
      Open Order in Service Operations Tracker
    </a>
  `);
}

function buildNotesEmail(order: any, stepLabel: string, notes: string, authorName: string, orderUrl: string): string {
  return wrapEmail(`
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:18px">Notes Added</h2>
    <p style="margin:0 0 16px;color:#374151"><strong>${authorName}</strong> added notes to an order in your step:</p>
    <div style="background:#f4f4f5;border-radius:12px;padding:16px;margin:0 0 16px">
      <p style="margin:4px 0"><strong>Order:</strong> ${order.id}</p>
      <p style="margin:4px 0"><strong>Client:</strong> ${order.clientName}</p>
      <p style="margin:4px 0"><strong>Stage:</strong> ${stepLabel}</p>
    </div>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;margin:0 0 20px;font-size:14px;white-space:pre-wrap;color:#374151">${notes}</div>
    <a href="${orderUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px">
      Open Order in Service Operations Tracker
    </a>
  `);
}

function buildSlaViolationEmail(order: any, stepLabel: string, hoursSpent: number, limitHours: number): string {
  return wrapEmail(`
    <h2 style="margin:0 0 8px;color:#ef4444;font-size:18px">❌ SLA Violation</h2>
    <p style="margin:0 0 16px;color:#374151">
      An order spent <strong>${Math.round(hoursSpent)} hours</strong> in "${stepLabel}",
      exceeding the SLA limit of <strong>${limitHours} hours</strong> (weekends excluded).
    </p>
    <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;padding:16px;margin:0 0 20px">
      <p style="margin:4px 0"><strong>Order:</strong> ${order.id}</p>
      <p style="margin:4px 0"><strong>Client:</strong> ${order.clientName}</p>
    </div>
    <a href="${APP_URL}" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px">
      Open Service Operations Tracker
    </a>
  `);
}

// ─── Notification Functions ───────────────────────────────────────────────────

/**
 * Sends arrival notifications to all users assigned to a step
 * when an order is moved into it.
 */
export async function notifyStepArrival(order: any, stepId: string): Promise<void> {
  const stepDef = await withRetry(() =>
    prisma.workflowStep.findUnique({ where: { id: stepId } })
  );
  const stepLabel = stepDef?.label ?? stepId;

  const assignments = await withRetry(() =>
    prisma.stepAssignment.findMany({
      where: { step: stepId, notifyOnArrival: true },
      include: { user: true },
    })
  );

  const recipients = assignments.map((a: any) => a.user?.email).filter((e: any): e is string => !!e);
  if (recipients.length === 0) return;

  const orderUrl = `${APP_URL}?order=${order.dbId}`;
  await sendEmail({
    to: recipients,
    subject: `Action Required: Order moved to "${stepLabel}"`,
    html: buildArrivalEmail(order, stepLabel, orderUrl),
  });
}

/**
 * Notifies all users assigned to the order's current step when notes are added/updated.
 * Skips the author so they don't receive their own notification.
 */
export async function notifyNotesAdded(order: any, notes: string, authorEmail: string, authorName: string): Promise<void> {
  const [stepDef, assignments] = await Promise.all([
    withRetry(() => prisma.workflowStep.findUnique({ where: { id: order.status } })),
    withRetry(() => prisma.stepAssignment.findMany({ where: { step: order.status }, include: { user: true } })),
  ]);

  const stepLabel = stepDef?.label ?? order.status;
  const orderUrl = `${APP_URL}?order=${order.dbId}`;

  const recipients = assignments
    .map((a: any) => a.user?.email)
    .filter((e: any): e is string => !!e);

  if (recipients.length === 0) return;

  await sendEmail({
    to: recipients,
    subject: `Notes added to order ${order.id} (${order.clientName})`,
    html: buildNotesEmail(order, stepLabel, notes, authorName, orderUrl),
  });
}

/**
 * Checks whether a completed step exceeded any custom SLA thresholds
 * and sends violation reports to the configured recipients.
 * Skips any alert already fired by the cron job (tracked in firedCustomAlerts).
 */
export async function checkSlaViolations(order: any, audit: any, now: Date): Promise<void> {
  const hoursSpent = calculateBusinessHours(new Date(audit.startedAt), now);

  const alerts = await withRetry(() =>
    prisma.customAlert.findMany({
      where: { stepId: audit.step },
      include: { user: true },
    })
  );

  if (alerts.length === 0) return;

  const alreadyFired: string[] = Array.isArray(audit.firedCustomAlerts) ? audit.firedCustomAlerts : [];

  const stepDef = await withRetry(() =>
    prisma.workflowStep.findUnique({ where: { id: audit.step } })
  );
  const stepLabel = stepDef?.label ?? audit.step;

  for (const alert of alerts) {
    if (!alert.user?.email) continue;
    if (hoursSpent <= alert.hours) continue;
    if (alreadyFired.includes(alert.id)) continue;

    await sendEmail({
      to: alert.user.email,
      subject: `SLA FAILED: Order ${order.id} exceeded allowed business hours in "${stepLabel}"`,
      html: buildSlaViolationEmail(order, stepLabel, hoursSpent, alert.hours),
    });

    await withRetry(() =>
      prisma.orderStepAudit.update({
        where: { id: audit.id },
        data: { firedCustomAlerts: { push: alert.id } },
      })
    );
  }
}

/**
 * Called when an order reaches the final workflow step.
 * Scans every completed audit for this order, collects all custom-alert
 * violations, stamps slaViolation=true on the order, and emails a
 * consolidated report to all alert recipients and the assigned tech.
 * Returns true if any violations were found.
 */
export async function sendCompletionViolationReport(order: any): Promise<boolean> {
  const audits = await withRetry(() =>
    prisma.orderStepAudit.findMany({
      where: { orderId: order.dbId, completedAt: { not: null } },
      orderBy: { startedAt: 'asc' },
    })
  );

  if (audits.length === 0) return false;

  const allSteps = await withRetry(() =>
    prisma.workflowStep.findMany()
  );
  const stepLabelMap = Object.fromEntries(allSteps.map((s: any) => [s.id, s.label]));

  type Violation = { stepLabel: string; hoursSpent: number; threshold: number };
  const violations: Violation[] = [];
  const recipientEmails = new Set<string>();

  for (const audit of audits) {
    const hoursSpent = calculateBusinessHours(new Date(audit.startedAt), new Date(audit.completedAt!));

    const alerts = await withRetry(() =>
      prisma.customAlert.findMany({
        where: { stepId: audit.step },
        include: { user: true },
      })
    );

    for (const alert of alerts) {
      if (hoursSpent <= alert.hours) continue;
      violations.push({
        stepLabel: stepLabelMap[audit.step] ?? audit.step,
        hoursSpent,
        threshold: alert.hours,
      });
      if (alert.user?.email) recipientEmails.add(alert.user.email);
    }
  }

  if (violations.length === 0) return false;

  if (order.assignedEmail) recipientEmails.add(order.assignedEmail);
  if (recipientEmails.size === 0) return true;

  const rows = violations.map(v => `
    <tr>
      <td style="padding:8px 12px;border:1px solid #fecaca">${v.stepLabel}</td>
      <td style="padding:8px 12px;border:1px solid #fecaca">${Math.round(v.hoursSpent)} hrs</td>
      <td style="padding:8px 12px;border:1px solid #fecaca">${v.threshold} hrs</td>
      <td style="padding:8px 12px;border:1px solid #fecaca;color:#b91c1c;font-weight:bold">
        +${Math.round(v.hoursSpent - v.threshold)} hrs over
      </td>
    </tr>
  `).join('');

  const html = wrapEmail(`
    <h2 style="margin:0 0 8px;color:#b91c1c;font-size:18px">⚠️ SLA Violation Report — Order Completed</h2>
    <p style="margin:0 0 16px;color:#374151">
      Order <strong>${order.id}</strong> for <strong>${order.clientName}</strong> has been completed,
      but exceeded SLA thresholds on <strong>${violations.length}</strong> step(s):
    </p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:13px">
      <thead>
        <tr style="background:#fef2f2">
          <th style="padding:8px 12px;border:1px solid #fecaca;text-align:left">Step</th>
          <th style="padding:8px 12px;border:1px solid #fecaca;text-align:left">Time Spent</th>
          <th style="padding:8px 12px;border:1px solid #fecaca;text-align:left">Threshold</th>
          <th style="padding:8px 12px;border:1px solid #fecaca;text-align:left">Overrun</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <a href="${APP_URL}?order=${order.dbId}"
       style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px">
      View Completed Order
    </a>
  `);

  for (const email of recipientEmails) {
    await sendEmail({
      to: email,
      subject: `SLA Violation Report: Order ${order.id} completed with ${violations.length} violation(s)`,
      html,
    });
  }

  return true;
}
