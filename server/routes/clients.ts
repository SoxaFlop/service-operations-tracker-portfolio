/**
 * clients.ts — Client Routes
 *
 * CRUD endpoints for managing clients:
 *   - GET    /        — list all clients (Account Managers see only their assigned clients)
 *   - POST   /        — create a new client (Account Managers are auto-assigned)
 *   - PATCH  /:id     — update a client's details; admins can reassign bdmId
 *   - DELETE /:id     — delete a client (orders are unlinked, not deleted)
 *
 * All routes require authentication.
 * All database queries use withRetry for transient connection resilience.
 */

import { Router, Request, Response } from 'express';
import { prisma, withRetry } from '../db.js';
import { authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

const bdmInclude = {
  bdm: { select: { id: true, displayName: true, email: true } },
  bdms: { where: { role: 'bdm' }, select: { id: true, displayName: true, email: true } },
};

// ─── Routes ───────────────────────────────────────────────────────────────────

/** GET / — Return clients. Account Managers see only their assigned clients unless ?all=true. */
router.get('/', async (req: any, res: Response) => {
  try {
    const skipFilter = req.query.all === 'true';
    const where = req.user.role === 'bdm' && !skipFilter
      ? { OR: [{ bdmId: req.user.id }, { bdms: { some: { id: req.user.id } } }] }
      : {};
    const clients = await withRetry(() =>
      prisma.client.findMany({ where, orderBy: { name: 'asc' }, include: bdmInclude })
    );
    res.json(clients);
  } catch {
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

/** POST / — Create a new client. Admins only. */
router.post('/', async (req: any, res: Response): Promise<any> => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can create clients' });
    const { name, contactName, email, ccEmails, bdmIds } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Missing required fields: name and email' });

    const ids: string[] = Array.isArray(bdmIds) ? bdmIds.filter(Boolean) : [];
    const client = await withRetry(() =>
      prisma.client.create({
        data: {
          name, contactName: contactName ?? '', email, ccEmails: ccEmails ?? null,
          bdmId: ids[0] ?? null,
          ...(ids.length > 0 ? { bdms: { connect: ids.map((id: string) => ({ id })) } } : {}),
        },
        include: bdmInclude,
      })
    );
    res.json(client);
  } catch {
    res.status(500).json({ error: 'Failed to create client' });
  }
});

/** PATCH /:id — Update a client's fields. Admins only. */
router.patch('/:id', async (req: any, res: Response): Promise<any> => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can edit clients' });
    const { id } = req.params;
    const { name, contactName, email, ccEmails, bdmIds } = req.body;

    const data: any = { name, contactName, email, ccEmails };
    if (req.user.role === 'admin' && bdmIds !== undefined) {
      const ids: string[] = Array.isArray(bdmIds) ? bdmIds.filter(Boolean) : [];
      data.bdms = { set: ids.map((id: string) => ({ id })) };
      data.bdmId = ids[0] ?? null;
    }

    const client = await withRetry(() =>
      prisma.client.update({ where: { id }, data, include: bdmInclude })
    );
    res.json(client);
  } catch {
    res.status(500).json({ error: 'Failed to update client' });
  }
});

/**
 * DELETE /:id — Delete a client.
 * Orders linked to this client are unlinked (clientId set to null) rather than deleted,
 * preserving the order history.
 */
router.delete('/:id', async (req: any, res: Response): Promise<any> => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { id } = req.params;
    await withRetry(() => prisma.order.updateMany({ where: { clientId: id }, data: { clientId: null } }));
    await withRetry(() => prisma.client.delete({ where: { id } }));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

export default router;
