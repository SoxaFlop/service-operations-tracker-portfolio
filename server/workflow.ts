/**
 * workflow.ts — Workflow Step Helpers
 *
 * Centralised functions for querying workflow step boundaries.
 * All business logic that needs the first/last step should use these
 * helpers to avoid duplicate database queries scattered across routes.
 */

import { prisma, withRetry } from './db.js';

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Returns the ID of the first workflow step (by position).
 * Falls back to the legacy 'quotation_request' string if no steps exist.
 */
export async function getInitialStatus(): Promise<string> {
  const firstStep = await withRetry(() =>
    prisma.workflowStep.findFirst({ orderBy: { position: 'asc' } })
  );
  return firstStep?.id ?? 'quotation_request';
}

/**
 * Returns the ID of the last workflow step (by position).
 * Falls back to the legacy 'tax_invoice_shared' string if no steps exist.
 */
export async function getLastStepId(): Promise<string> {
  const steps = await withRetry(() =>
    prisma.workflowStep.findMany({ orderBy: { position: 'asc' } })
  );
  return steps.length > 0 ? steps[steps.length - 1].id : 'tax_invoice_shared';
}

/**
 * Checks whether a given status string maps to an existing workflow step.
 */
export async function isValidStatus(status: string): Promise<boolean> {
  const step = await withRetry(() =>
    prisma.workflowStep.findUnique({ where: { id: status } })
  );
  return !!step;
}
