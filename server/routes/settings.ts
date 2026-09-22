/**
 * settings.ts — Settings & Admin Routes
 *
 * Admin-only configuration endpoints for managing:
 *   - Workflow Steps       (GET/POST/PUT/DELETE /steps)
 *   - Step Assignments     (GET/POST /step-assignments)
 *   - Document Triggers    (GET/POST/PUT/DELETE /document-triggers)
 *   - Custom SLA Alerts    (GET/POST/DELETE /custom-alerts)
 *   - Maintenance          (POST /cleanup-orders)
 *
 * All routes are protected by authMiddleware. Admin role is required
 * for all mutating operations.
 * All database queries use withRetry for transient connection resilience.
 */

import { Router, Response } from 'express';
import { prisma, withRetry } from '../db.js';
import { authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Shorthand guard: returns 403 if the requester is not an admin. */
function adminOnly(req: any, res: Response): boolean {
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }
  return true;
}

// ─── Workflow Steps ───────────────────────────────────────────────────────────

/** GET /steps — Return all workflow steps ordered by position. */
router.get('/steps', async (_req: any, res: Response): Promise<any> => {
  try {
    const steps = await withRetry(() =>
      prisma.workflowStep.findMany({ orderBy: { position: 'asc' } })
    );
    res.json(steps);
  } catch {
    res.status(500).json({ error: 'Failed to fetch steps' });
  }
});

/** POST /steps — Create a new workflow step. Admin only. */
router.post('/steps', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const { id, label, color, position } = req.body;
    if (!id || !label || !color) return res.status(400).json({ error: 'Missing fields: id, label, color are required' });

    const step = await withRetry(() =>
      prisma.workflowStep.create({ data: { id, label, color, position: position ?? 0 } })
    );
    res.json(step);
  } catch {
    res.status(500).json({ error: 'Failed to create step' });
  }
});

/** PUT /steps/reorder — Update the position of multiple steps at once. Admin only. */
router.put('/steps/reorder', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Expected an array of step IDs' });

    await Promise.all(
      order.map((id: string, index: number) =>
        withRetry(() =>
          prisma.workflowStep.update({ where: { id }, data: { position: index + 1 } })
        )
      )
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to reorder steps' });
  }
});

/** PUT /steps/:id — Update a workflow step's label, color, or position. Admin only. */
router.put('/steps/:id', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const { id } = req.params;
    const { label, color, position, canSkip, isExternalTeam, clientReminderEnabled } = req.body;
    const data: any = {};
    if (label !== undefined) data.label = label;
    if (color !== undefined) data.color = color;
    if (position !== undefined) data.position = position;
    if (canSkip !== undefined) data.canSkip = canSkip;
    if (isExternalTeam !== undefined) data.isExternalTeam = isExternalTeam;
    if (clientReminderEnabled !== undefined) data.clientReminderEnabled = clientReminderEnabled;
    const step = await withRetry(() =>
      prisma.workflowStep.update({ where: { id }, data })
    );
    res.json(step);
  } catch {
    res.status(500).json({ error: 'Failed to update step' });
  }
});

/** DELETE /steps/:id — Delete a workflow step and its assignments. Admin only. */
router.delete('/steps/:id', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const { id } = req.params;
    // Remove assignments first to avoid orphaned references
    await withRetry(() => prisma.stepAssignment.deleteMany({ where: { step: id } }));
    await withRetry(() => prisma.workflowStep.delete({ where: { id } }));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete step' });
  }
});

// ─── Step Assignments ─────────────────────────────────────────────────────────

/** GET /step-assignments — Return all step assignments with user info. Admin only. */
router.get('/step-assignments', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const assignments = await withRetry(() =>
      prisma.stepAssignment.findMany({ include: { user: true } })
    );
    res.json(assignments);
  } catch {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

/**
 * POST /step-assignments — Replace all assignments for a given step.
 * Deletes existing assignments for the step, then creates the new set.
 * Admin only.
 */
router.post('/step-assignments', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const { step, assignments } = req.body;
    if (!step || !Array.isArray(assignments)) {
      return res.status(400).json({ error: 'Missing fields: step and assignments are required' });
    }

    await withRetry(() => prisma.stepAssignment.deleteMany({ where: { step } }));

    if (assignments.length > 0) {
      await withRetry(() =>
        prisma.stepAssignment.createMany({
          data: assignments.map((a: any) => ({
            step,
            userId: a.userId,
            notifyOnArrival: !!a.notifyOnArrival,
            notifyOnSLA: !!a.notifyOnSLA,
            canAdvance: a.canAdvance !== undefined ? !!a.canAdvance : true,
          })),
        })
      );
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to save assignments' });
  }
});

/**
 * GET /advance-permissions — Returns { [stepId]: boolean } for the current user.
 * true = user can press Next on that step. Applies to all roles including admins.
 * If a step has no canAdvance assignments, everyone can advance it.
 */
router.get('/advance-permissions', async (req: any, res: Response): Promise<any> => {
  try {
    const allAssignments = await withRetry(() => prisma.stepAssignment.findMany());
    const byStep: Record<string, typeof allAssignments> = {};
    allAssignments.forEach((a: any) => {
      if (!byStep[a.step]) byStep[a.step] = [];
      byStep[a.step].push(a);
    });

    const result: Record<string, boolean> = {};
    for (const [stepId, assignments] of Object.entries(byStep)) {
      const thisUser = (assignments as any[]).find((a: any) => a.userId === req.user.id);
      const advancers = (assignments as any[]).filter((a: any) => a.canAdvance);
      if (thisUser && !thisUser.canAdvance) {
        result[stepId] = false;
      } else if (advancers.length === 0) {
        result[stepId] = true;
      } else {
        result[stepId] = advancers.some((a: any) => a.userId === req.user.id);
      }
    }
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// ─── Document Triggers ────────────────────────────────────────────────────────

/** GET /document-triggers — Return all document triggers. Admin only. */
router.get('/document-triggers', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const triggers = await withRetry(() => prisma.stepDocumentTrigger.findMany());
    res.json(triggers);
  } catch {
    res.status(500).json({ error: 'Failed to fetch document triggers' });
  }
});

/** POST /document-triggers — Create a new document trigger. Admin only. */
router.post('/document-triggers', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const { step, document, recipientType, customEmail, subject, emailBody, clearAllAttachmentsAfter } = req.body;
    if (!step || !document) return res.status(400).json({ error: 'Missing fields: step and document are required' });

    const trigger = await withRetry(() =>
      prisma.stepDocumentTrigger.create({
        data: {
          step, document,
          recipientType: recipientType ?? 'client',
          customEmail: customEmail ?? null,
          subject: subject ?? null,
          emailBody: emailBody ?? null,
          enabled: true,
          clearAllAttachmentsAfter: !!clearAllAttachmentsAfter,
        },
      })
    );
    res.json(trigger);
  } catch {
    res.status(500).json({ error: 'Failed to create trigger' });
  }
});

/** PUT /document-triggers/:id — Update a document trigger. Admin only. */
router.put('/document-triggers/:id', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const { id } = req.params;
    const { document, recipientType, customEmail, subject, emailBody, enabled, clearAllAttachmentsAfter } = req.body;
    const trigger = await withRetry(() =>
      prisma.stepDocumentTrigger.update({
        where: { id },
        data: {
          ...(document !== undefined && { document }),
          recipientType, customEmail,
          subject: subject ?? null,
          emailBody: emailBody ?? null,
          enabled,
          clearAllAttachmentsAfter: !!clearAllAttachmentsAfter,
        },
      })
    );
    res.json(trigger);
  } catch {
    res.status(500).json({ error: 'Failed to update trigger' });
  }
});

/** DELETE /document-triggers/:id — Delete a document trigger. Admin only. */
router.delete('/document-triggers/:id', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    await withRetry(() => prisma.stepDocumentTrigger.delete({ where: { id: req.params.id } }));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete trigger' });
  }
});

// ─── Thank-You Emails ─────────────────────────────────────────────────────────

/** GET /thank-you-emails — Return all per-step thank-you email configs. Admin only. */
router.get('/thank-you-emails', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const rows = await withRetry(() => prisma.stepThankYouEmail.findMany());
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch thank-you emails' });
  }
});

/** POST /thank-you-emails — Upsert the thank-you email config for a step. Admin only. */
router.post('/thank-you-emails', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const { step, enabled, subject, emailBody } = req.body;
    if (!step) return res.status(400).json({ error: 'step is required' });
    const row = await withRetry(() =>
      prisma.stepThankYouEmail.upsert({
        where: { step },
        create: { step, enabled: !!enabled, subject: subject ?? null, emailBody: emailBody ?? null },
        update: { enabled: !!enabled, subject: subject ?? null, emailBody: emailBody ?? null },
      })
    );
    res.json(row);
  } catch {
    res.status(500).json({ error: 'Failed to save thank-you email' });
  }
});

// ─── Custom SLA Alerts ────────────────────────────────────────────────────────

/** GET /custom-alerts — Return all custom SLA alerts with user info. Admin only. */
router.get('/custom-alerts', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const alerts = await withRetry(() =>
      prisma.customAlert.findMany({ include: { user: true } })
    );
    res.json(alerts);
  } catch {
    res.status(500).json({ error: 'Failed to fetch custom alerts' });
  }
});

/** POST /custom-alerts — Create a new SLA alert for a specific step and user. Admin only. */
router.post('/custom-alerts', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const { stepId, hours, userId } = req.body;
    if (!stepId || !hours || !userId) return res.status(400).json({ error: 'Missing fields: stepId, hours, userId are required' });

    const alert = await withRetry(() =>
      prisma.customAlert.create({ data: { stepId, hours: Number(hours), userId } })
    );
    const populated = await withRetry(() =>
      prisma.customAlert.findUnique({ where: { id: alert.id }, include: { user: true } })
    );
    res.json(populated);
  } catch {
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

/** DELETE /custom-alerts/:id — Delete a custom SLA alert. Admin only. */
router.delete('/custom-alerts/:id', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    await withRetry(() => prisma.customAlert.delete({ where: { id: req.params.id } }));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// ─── Maintenance ──────────────────────────────────────────────────────────────

/**
 * POST /cleanup-orders — Remove orders with statuses that don't match any
 * existing workflow step. Useful if steps were deleted or renamed.
 * Admin only.
 */
router.post('/cleanup-orders', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const steps = await withRetry(() =>
      prisma.workflowStep.findMany({ orderBy: { position: 'asc' } })
    );
    const validStepIds = steps.map(s => s.id);

    if (validStepIds.length === 0) {
      return res.status(400).json({ error: 'No workflow steps exist. Create steps before running cleanup.' });
    }

    const orphanedOrders = await withRetry(() =>
      prisma.order.findMany({
        where: { status: { notIn: validStepIds } },
        select: { dbId: true, id: true, clientName: true, status: true },
      })
    );

    if (orphanedOrders.length === 0) {
      return res.json({ removed: 0, message: 'No orphaned orders found — all orders have valid statuses.' });
    }

    const orphanedIds = orphanedOrders.map(o => o.dbId);
    await withRetry(() => prisma.order.deleteMany({ where: { dbId: { in: orphanedIds } } }));

    console.log(`[Cleanup] Removed ${orphanedOrders.length} orphaned orders:`, orphanedOrders.map(o => `${o.id} (status: ${o.status})`));

    res.json({
      removed: orphanedOrders.length,
      orders: orphanedOrders.map(o => ({ id: o.id, client: o.clientName, status: o.status })),
      message: `Removed ${orphanedOrders.length} order(s) with invalid statuses.`,
    });
  } catch (err: any) {
    console.error('[Cleanup] Error:', err);
    res.status(500).json({ error: 'Cleanup failed', detail: err.message });
  }
});

// ─── Date-Range SLA Rules ─────────────────────────────────────────────────────

/** GET /date-range-sla-rules — List all rules, optionally filtered by stepId. Admin only. */
router.get('/date-range-sla-rules', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const { stepId } = req.query;
    const rules = await withRetry(() =>
      prisma.dateRangeSlaRule.findMany({
        where: stepId ? { stepId: stepId as string } : {},
        include: { user: { select: { id: true, displayName: true, email: true } }, step: { select: { label: true } } },
        orderBy: { createdAt: 'asc' },
      })
    );
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch date-range SLA rules' });
  }
});

/** POST /date-range-sla-rules — Create a date-range SLA rule. Admin only. */
router.post('/date-range-sla-rules', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const { stepId, fromDay, toDay, hours, userId } = req.body;
    if (!stepId || fromDay == null || toDay == null || hours == null) {
      return res.status(400).json({ error: 'stepId, fromDay, toDay and hours are required' });
    }
    if (fromDay < 1 || fromDay > 31 || toDay < 1 || toDay > 31 || fromDay > toDay) {
      return res.status(400).json({ error: 'fromDay and toDay must be 1–31 with fromDay ≤ toDay' });
    }
    const rule = await withRetry(() =>
      prisma.dateRangeSlaRule.create({
        data: { stepId, fromDay: Number(fromDay), toDay: Number(toDay), hours: Number(hours), userId: userId ?? null },
        include: { user: { select: { id: true, displayName: true, email: true } }, step: { select: { label: true } } },
      })
    );
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create date-range SLA rule' });
  }
});

/** PUT /date-range-sla-rules/:id — Update a date-range SLA rule. Admin only. */
router.put('/date-range-sla-rules/:id', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const { fromDay, toDay, hours, userId } = req.body;
    const updateData: Record<string, any> = {};
    if (fromDay != null) updateData.fromDay = Number(fromDay);
    if (toDay != null) updateData.toDay = Number(toDay);
    if (hours != null) updateData.hours = Number(hours);
    if (userId !== undefined) updateData.userId = userId ?? null;

    const rule = await withRetry(() =>
      prisma.dateRangeSlaRule.update({
        where: { id: req.params.id },
        data: updateData,
        include: { user: { select: { id: true, displayName: true, email: true } }, step: { select: { label: true } } },
      })
    );
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update date-range SLA rule' });
  }
});

/** DELETE /date-range-sla-rules/:id — Delete a date-range SLA rule. Admin only. */
router.delete('/date-range-sla-rules/:id', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    await withRetry(() => prisma.dateRangeSlaRule.delete({ where: { id: req.params.id } }));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete date-range SLA rule' });
  }
});

// ─── Step Attachment Requirements ─────────────────────────────────────────────

/** GET /step-requirements — Return all attachment requirements. Admin only. */
router.get('/step-requirements', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const rows = await withRetry(() => prisma.stepAttachmentRequirement.findMany());
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch step requirements' });
  }
});

/** PUT /step-requirements/:step — Upsert attachment requirements for a step. Admin only. */
router.put('/step-requirements/:step', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const { step } = req.params;
    const { documents } = req.body;
    if (documents === undefined) return res.status(400).json({ error: 'documents is required' });
    const row = await withRetry(() =>
      prisma.stepAttachmentRequirement.upsert({
        where: { step },
        create: { step, documents },
        update: { documents },
      })
    );
    res.json(row);
  } catch {
    res.status(500).json({ error: 'Failed to save step requirements' });
  }
});

export default router;
