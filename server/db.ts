/**
 * db.ts — Database Client
 *
 * A single shared PrismaClient instance for the entire application.
 *
 * Some managed PostgreSQL poolers close idle connections. The `withRetry`
 * helper handles those transient failures without coupling this project to a
 * specific database provider.
 */

import { PrismaClient } from '@prisma/client';

// ─── Client Singleton ─────────────────────────────────────────────────────────

declare global {
  // Prevents multiple instances during development hot-reloads.
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const _prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: [{ emit: 'event', level: 'error' }, { emit: 'stdout', level: 'warn' }],
  });

// Suppress expected idle-connection noise; re-log everything else.
(_prisma as any).$on('error', (e: any) => {
  if (e.message?.includes('kind: Closed')) return;
  console.error('prisma:error', e.message);
});

export const prisma = _prisma;

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// ─── Connection Retry Wrapper ─────────────────────────────────────────────────

/**
 * Wraps a Prisma query in a small retry loop for transient connection errors.
 *
 * Usage:
 *   const users = await withRetry(() => prisma.user.findMany());
 */
const isConnectionError = (e: any) =>
  e?.message?.includes('Closed') || e?.code === 'P1001' || e?.code === 'P2024';

export async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (isConnectionError(error) && attempt < retries - 1) {
        const delay = 500 * (attempt + 1); // 500ms, 1000ms
        console.warn(`[DB] Connection closed — retry ${attempt + 1}/${retries - 1} in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        await prisma.$disconnect();
        await prisma.$connect();
        continue;
      }
      throw error;
    }
  }
  throw new Error('[DB] withRetry: exhausted all retries');
}
