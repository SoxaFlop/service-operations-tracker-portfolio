/**
 * auth.ts — Authentication Routes & Middleware
 *
 * Implements a passwordless OTP (One-Time Password) login flow:
 *   - POST /send-otp      — sends a 6-digit code to the user's work email
 *   - POST /verify-otp    — validates the code and returns a JWT
 *   - POST /revoke-sessions — invalidates all other sessions for the current user
 *   - GET  /me            — returns the current authenticated user's profile
 *
 * User management (admin only):
 *   - GET    /users       — list all users
 *   - POST   /users       — create a user
 *   - PATCH  /users/:id   — update a user's role or display name
 *   - DELETE /users/:id   — delete a user and their orders
 *
 * All database queries use withRetry for transient connection resilience.
 */

import 'dotenv/config';
import { Router, Request, Response } from 'express';
import { prisma, withRetry } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendEmail } from '../smtp.js';
import { wrapEmail } from '../lib/emailTemplate.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET is required and must be at least 32 characters');
}

const parseCsv = (value?: string) =>
  new Set((value ?? '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean));

const ALLOWED_EMAIL_DOMAINS = parseCsv(process.env.ALLOWED_EMAIL_DOMAINS);
const ADMIN_EMAILS = parseCsv(process.env.ADMIN_EMAILS);

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * authMiddleware — Validates the JWT in the Authorization header.
 * Also checks the stored tokenVersion to support remote sign-out.
 */
export const authMiddleware = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const activeUser = await withRetry(() =>
      prisma.user.findUnique({
        where: { id: decoded.id },
        select: { tokenVersion: true },
      })
    );

    if (!activeUser || activeUser.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── OTP Login Flow ───────────────────────────────────────────────────────────

/** POST /send-otp — Generate a 6-digit OTP and email it to the user. */
router.post('/send-otp', async (req: Request, res: Response): Promise<any> => {
  try {
    if (!req.body.email) return res.status(400).json({ error: 'Email is required' });

    // Normalise to lowercase so "User@x.com" and "user@x.com" always resolve to
    // the same account instead of silently creating a second one.
    const email = req.body.email.toLowerCase().trim();
    const domain = email.split('@')[1];
    const isAdminEmail = ADMIN_EMAILS.has(email);

    if (!ALLOWED_EMAIL_DOMAINS.has(domain) && !isAdminEmail) {
      return res.status(403).json({ error: 'Email address is not authorised for this system' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await withRetry(() =>
      prisma.user.upsert({
        where: { email },
        update: { otpCode: otp, otpExpiresAt: expiresAt },
        create: {
          email,
          displayName: email.split('@')[0],
          role: isAdminEmail ? 'admin' : 'viewer',
          otpCode: otp,
          otpExpiresAt: expiresAt,
        },
      })
    );

    const sent = await sendEmail({
      to: email,
      subject: 'Your Service Operations Tracker Login Code',
      html: wrapEmail(`
        <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:18px">Your Login Code</h2>
        <div style="background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;margin:0 0 16px">
          <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#18181b">${otp}</span>
        </div>
        <p style="margin:0 0 8px;color:#71717a;font-size:14px">This code expires in 5 minutes.</p>
        <p style="margin:0;color:#a1a1aa;font-size:12px">If you did not request this, you can safely ignore this email.</p>
      `),
    });

    if (!sent) {
      return res.status(503).json({ error: 'Email delivery is not configured' });
    }

    res.json({ success: true, message: 'Login code sent to your email' });
  } catch (error) {
    console.error('[Auth] Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send login code' });
  }
});

/** POST /verify-otp — Validate the OTP and return a signed JWT. */
router.post('/verify-otp', async (req: Request, res: Response): Promise<any> => {
  try {
    const { code } = req.body;
    if (!req.body.email || !code) return res.status(400).json({ error: 'Email and code are required' });
    const email = req.body.email.toLowerCase().trim();

    const user = await withRetry(() => prisma.user.findUnique({ where: { email } }));
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.otpCode || user.otpCode !== code) {
      return res.status(400).json({ error: 'Invalid code' });
    }
    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ error: 'Code has expired. Please request a new one.' });
    }

    // Invalidate the OTP immediately after use
    await withRetry(() =>
      prisma.user.update({ where: { email }, data: { otpCode: null, otpExpiresAt: null } })
    );

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, displayName: user.displayName, tokenVersion: user.tokenVersion },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, user: { id: user.id, uid: user.id, email: user.email, role: user.role, displayName: user.displayName } });
  } catch (error) {
    console.error('[Auth] Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

/** POST /login — Password-based login. */
router.post('/login', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await withRetry(() => prisma.user.findUnique({ where: { email: email.toLowerCase() } }));
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials or password not set' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid password' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, displayName: user.displayName, tokenVersion: user.tokenVersion },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, user: { id: user.id, uid: user.id, email: user.email, role: user.role, displayName: user.displayName } });
  } catch (error) {
    console.error('[Auth] Password login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

/** POST /set-password — Set or update the current user's password. */
router.post('/set-password', authMiddleware, async (req: any, res: Response): Promise<any> => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await withRetry(() =>
      prisma.user.update({
        where: { id: req.user.id },
        data: { password: passwordHash }
      })
    );

    res.json({ success: true, message: 'Password set successfully' });
  } catch (error) {
    console.error('[Auth] Set password error:', error);
    res.status(500).json({ error: 'Failed to set password' });
  }
});

/** GET /check-auth — Checks if an email has a password set (used to show/hide password field). */
router.get('/check-auth', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.query;
    if (!email) return res.json({ hasPassword: false });

    const user = await withRetry(() => prisma.user.findUnique({ where: { email: (email as string).toLowerCase() } }));
    res.json({ hasPassword: !!user?.password });
  } catch {
    res.json({ hasPassword: false });
  }
});

// ─── Session Management ───────────────────────────────────────────────────────

/**
 * POST /revoke-sessions — Increments the user's tokenVersion, invalidating
 * all existing sessions. Issues a fresh token for the current device.
 */
router.post('/revoke-sessions', authMiddleware, async (req: any, res: any): Promise<any> => {
  try {
    const user = await withRetry(() =>
      prisma.user.update({
        where: { id: req.user.id },
        data: { tokenVersion: { increment: 1 } },
      })
    );

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, displayName: user.displayName, tokenVersion: user.tokenVersion },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ success: true, token, message: 'All other sessions have been signed out' });
  } catch {
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

// ─── Profile ──────────────────────────────────────────────────────────────────

/** GET /me — Return the current user's profile. Used to validate stored tokens on app load. */
router.get('/me', authMiddleware, async (req: any, res: any): Promise<any> => {
  try {
    const user = await withRetry(() => prisma.user.findUnique({ where: { id: req.user.id } }));
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName, createdAt: user.createdAt.toISOString() } });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── User Management (Admin Only) ────────────────────────────────────────────

/**
 * GET /users — Return all users ordered by most recently updated.
 * Admin only, unless ?assignable=true (Account Manager/admin roster, e.g. for client Account Manager
 * assignment) or ?assignable=all (every role, for assignee checklists on
 * orders/proposals/budget quotes) — both bypass the admin-only gate.
 */
router.get('/users', authMiddleware, async (req: any, res: any): Promise<any> => {
  const assignableParam = req.query.assignable;
  const bypassAdminGate = assignableParam === 'true' || assignableParam === 'all';
  if (!bypassAdminGate && req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  try {
    const where = assignableParam === 'true' ? { role: { in: ['admin', 'bdm'] } } : {};
    const users = await withRetry(() =>
      prisma.user.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, email: true, role: true, displayName: true, updatedAt: true },
      })
    );
    res.json(users.map(u => ({
      uid: u.id, email: u.email, displayName: u.displayName,
      role: u.role, lastLogin: u.updatedAt.toISOString(),
    })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/** POST /users — Create a new user account. Admin only. */
router.post('/users', authMiddleware, async (req: any, res: any): Promise<any> => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  try {
    const { email, displayName, role } = req.body;
    if (!email || !displayName) return res.status(400).json({ error: 'Missing required fields: email and displayName' });
    if (role && !['admin', 'user', 'ops', 'viewer', 'bdm'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const user = await withRetry(() =>
      prisma.user.create({
        data: { email: email.toLowerCase(), displayName, role: role ?? 'ops' },
      })
    );

    res.json({ uid: user.id, email: user.email, displayName: user.displayName, role: user.role, lastLogin: user.updatedAt.toISOString() });
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'A user with this email already exists' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/** PATCH /users/:id — Update a user's role or display name. Admin only. */
router.patch('/users/:id', authMiddleware, async (req: any, res: any): Promise<any> => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  try {
    const { id } = req.params;
    const { role, displayName } = req.body;

    if (id === req.user.id && role && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }
    if (role && !['admin', 'user', 'ops', 'viewer', 'bdm'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const updateData: Record<string, any> = {};
    if (role) updateData.role = role;
    if (displayName !== undefined) updateData.displayName = displayName;

    const user = await withRetry(() =>
      prisma.user.update({
        where: { id },
        data: updateData,
        select: { id: true, email: true, role: true, displayName: true, updatedAt: true },
      })
    );

    res.json({ uid: user.id, email: user.email, role: user.role, displayName: user.displayName, lastLogin: user.updatedAt.toISOString() });
  } catch (error) {
    console.error('[Auth] Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/** DELETE /users/:id — Delete a user and all orders they created. Admin only. */
router.delete('/users/:id', authMiddleware, async (req: any, res: any): Promise<any> => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });

    await withRetry(() => prisma.order.deleteMany({ where: { createdBy: id } }));
    await withRetry(() => prisma.user.delete({ where: { id } }));

    res.json({ success: true });
  } catch (error) {
    console.error('[Auth] Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
