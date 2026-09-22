import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Opens a "data:" URI (as used for stored document attachments) in a new tab.
 * Safari refuses to render data: URIs navigated to directly via target="_blank"
 * — the tab opens but stays blank — so this converts it to a blob: URL first,
 * which every browser can navigate to.
 */
export function openDataUriInNewTab(dataUri: string) {
  const commaIndex = dataUri.indexOf(',');
  if (commaIndex === -1) return;
  const mimeMatch = dataUri.slice(0, commaIndex).match(/^data:(.*?)(;base64)?$/);
  const mime = mimeMatch?.[1] || 'application/octet-stream';

  const binary = atob(dataUri.slice(commaIndex + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Tailwind classes for the small role badge shown next to a user's name in
 * assignee pickers — kept in one place since it's used across orders,
 * proposals, and budget quotes.
 */
export function roleBadgeClass(role: string): string {
  switch (role) {
    case 'admin': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    case 'user': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'ops': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    case 'bdm': return 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

/**
 * Calculates business days between two dates, excluding weekends.
 */
export function calculateBusinessDays(start: Date, end: Date): number {
  if (start >= end) return 0;

  let totalMs = 0;
  let curr = new Date(start);

  while (curr < end) {
    const day = curr.getDay();
    const isWeekend = day === 0 || day === 6;

    const nextDay = new Date(curr);
    nextDay.setDate(curr.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);

    const periodEnd = nextDay < end ? nextDay : end;

    if (!isWeekend) {
      totalMs += (periodEnd.getTime() - curr.getTime());
    }

    curr = periodEnd;
  }

  return totalMs / (1000 * 3600 * 24);
}
