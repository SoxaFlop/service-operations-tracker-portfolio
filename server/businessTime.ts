/**
 * businessTime.ts — Business Day and Hour Utilities
 *
 * Provides functions to calculate elapsed time excluding weekends (Saturday/Sunday).
 * Used for SLA tracking and stagnation alerts.
 */

/**
 * Calculates the number of business hours (excluding weekends) between two dates.
 */
export function calculateBusinessHours(start: Date, end: Date): number {
  if (start >= end) return 0;

  let totalMs = 0;
  let curr = new Date(start);

  while (curr < end) {
    const day = curr.getDay();
    const isWeekend = day === 0 || day === 6;

    // Get start of next day
    const nextDay = new Date(curr);
    nextDay.setDate(curr.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);

    const periodEnd = nextDay < end ? nextDay : end;

    if (!isWeekend) {
      totalMs += (periodEnd.getTime() - curr.getTime());
    }

    curr = periodEnd;
  }

  return totalMs / (1000 * 3600);
}

/**
 * Calculates the number of business days (excluding weekends) between two dates.
 * Returns a floating-point number representing partial days based on business hours / 24.
 */
export function calculateBusinessDays(start: Date, end: Date): number {
  return calculateBusinessHours(start, end) / 24;
}
