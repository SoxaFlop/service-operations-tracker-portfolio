import { Router, Response } from 'express';
import { prisma, withRetry } from '../db.js';
import { authMiddleware } from './auth.js';
import { calculateBusinessDays } from '../businessTime.js';

const router = Router();
router.use(authMiddleware);

function adminOnly(req: any, res: Response): boolean {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return false;
  }
  return true;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** GET / — Returns analytics data. Admin only. */
router.get('/', async (req: any, res: Response): Promise<any> => {
  if (!adminOnly(req, res)) return;
  try {
    const [steps, orders, completedAudits] = await Promise.all([
      withRetry(() => prisma.workflowStep.findMany({ orderBy: { position: 'asc' } })),
      withRetry(() =>
        prisma.order.findMany({
          select: { dbId: true, createdAt: true, updatedAt: true, slaViolation: true, category: true, status: true },
          orderBy: { createdAt: 'asc' },
        })
      ),
      withRetry(() =>
        prisma.orderStepAudit.findMany({
          where: { completedAt: { not: null } },
          select: { step: true, startedAt: true, completedAt: true },
        })
      ),
    ]);

    const lastStepId = steps[steps.length - 1]?.id;
    const completedOrders = orders.filter(o => o.status === lastStepId);
    const activeOrders = orders.filter(o => o.status !== lastStepId);
    const lateOrders = completedOrders.filter(o => o.slaViolation);
    const onTimeOrders = completedOrders.filter(o => !o.slaViolation);

    // Average completion days (from createdAt to updatedAt for completed orders)
    const completionDays = completedOrders.map(o => {
      return calculateBusinessDays(new Date(o.createdAt), new Date(o.updatedAt));
    });
    const avgCompletionDays = completionDays.length > 0
      ? Math.round((completionDays.reduce((s, d) => s + d, 0) / completionDays.length) * 10) / 10
      : null;

    // Per-step average duration from audit records
    const stepDurationsMap: Record<string, number[]> = {};
    for (const audit of completedAudits) {
      const days = calculateBusinessDays(new Date(audit.startedAt), new Date(audit.completedAt!));
      if (!stepDurationsMap[audit.step]) stepDurationsMap[audit.step] = [];
      stepDurationsMap[audit.step].push(days);
    }

    const byStep = steps
      .filter((s: any) => s.id !== lastStepId)
      .map((s: any) => {
        const durations = stepDurationsMap[s.id] || [];
        return {
          stepId: s.id,
          label: s.label,
          isExternalTeam: !!s.isExternalTeam,
          avgDays: durations.length > 0
            ? Math.round((durations.reduce((a: number, b: number) => a + b, 0) / durations.length) * 10) / 10
            : null,
          medianDays: durations.length > 0 ? Math.round(median(durations) * 10) / 10 : null,
          count: durations.length,
        };
      });

    // Orders by month (last 12 months)
    const now = new Date();
    const byMonth = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const label = d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
      const monthOrders = orders.filter(o => {
        const c = new Date(o.createdAt);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
      });
      const monthCompleted = monthOrders.filter(o => o.status === lastStepId);
      const monthLate = monthCompleted.filter(o => o.slaViolation);
      const monthCompletionDays = monthCompleted.map(o => {
        return calculateBusinessDays(new Date(o.createdAt), new Date(o.updatedAt));
      });
      const monthAvgCompletionDays = monthCompletionDays.length > 0
        ? Math.round((monthCompletionDays.reduce((s, d) => s + d, 0) / monthCompletionDays.length) * 10) / 10
        : null;

      return {
        month: label,
        count: monthOrders.length,
        completed: monthCompleted.length,
        lateCount: monthLate.length,
        avgCompletionDays: monthAvgCompletionDays,
      };
    });

    // By category
    const deviceManagementTotal = orders.filter(o => o.category === 'device_management').length;
    const techTotal     = orders.filter(o => o.category === 'tech_product').length;
    const salesTotal    = orders.filter(o => o.category === 'sales').length;
    const trainingTotal = orders.filter(o => o.category === 'training').length;
    const deviceManagementCompleted = completedOrders.filter(o => o.category === 'device_management').length;
    const techCompleted     = completedOrders.filter(o => o.category === 'tech_product').length;
    const salesCompleted    = completedOrders.filter(o => o.category === 'sales').length;
    const trainingCompleted = completedOrders.filter(o => o.category === 'training').length;
    const deviceManagementLate = lateOrders.filter(o => o.category === 'device_management').length;
    const techLate      = lateOrders.filter(o => o.category === 'tech_product').length;
    const salesLate     = lateOrders.filter(o => o.category === 'sales').length;
    const trainingLate  = lateOrders.filter(o => o.category === 'training').length;

    // Proposal stats
    const proposals = await withRetry(() =>
      prisma.proposal.findMany({ select: { status: true, createdAt: true } })
    );
    const proposalsByStatus = proposals.reduce((acc: Record<string, number>, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});
    const proposalsByMonth = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const label = d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
      const count = proposals.filter(p => {
        const c = new Date(p.createdAt);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
      }).length;
      return { month: label, count };
    });

    res.json({
      summary: {
        total: orders.length,
        completed: completedOrders.length,
        active: activeOrders.length,
        onTimeCount: onTimeOrders.length,
        lateCount: lateOrders.length,
        onTimeRate: completedOrders.length > 0
          ? Math.round((onTimeOrders.length / completedOrders.length) * 100)
          : null,
        avgCompletionDays,
      },
      byStep,
      byMonth,
      byCategory: [
        { category: 'device_management', label: 'Device Management', total: deviceManagementTotal, completed: deviceManagementCompleted, lateCount: deviceManagementLate },
        { category: 'tech_product', label: 'Tech Services',    total: techTotal,     completed: techCompleted,     lateCount: techLate },
        { category: 'sales',        label: 'Sales',            total: salesTotal,    completed: salesCompleted,    lateCount: salesLate },
        { category: 'training',     label: 'Training Services',total: trainingTotal, completed: trainingCompleted, lateCount: trainingLate },
      ],
      proposals: {
        total: proposals.length,
        byStatus: proposalsByStatus,
        byMonth: proposalsByMonth,
      },
    });
  } catch (err) {
    console.error('[Analytics] Error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
