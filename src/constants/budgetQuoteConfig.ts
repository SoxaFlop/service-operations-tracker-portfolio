import { BudgetQuoteStatus } from '../types';

export interface BudgetQuoteStatusConfig {
  label: string;
  dot: string;
  badge: string;
  colour: string;
}

export const BQ_STATUS_CONFIG: Record<BudgetQuoteStatus, BudgetQuoteStatusConfig> = {
  draft:            { label: 'Draft',            dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',           colour: 'bg-slate-100 text-slate-600' },
  pending_approval: { label: 'Pending Approval', dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',         colour: 'bg-amber-100 text-amber-700' },
  approved:         { label: 'Approved',         dot: 'bg-green-500',   badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',         colour: 'bg-green-100 text-green-700' },
  queried:          { label: 'Queried',          dot: 'bg-orange-500',  badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',     colour: 'bg-orange-100 text-orange-700' },
  sent:             { label: 'Sent',             dot: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',             colour: 'bg-blue-100 text-blue-700' },
  accepted:         { label: 'Accepted',         dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', colour: 'bg-emerald-100 text-emerald-700' },
  declined:         { label: 'Declined',         dot: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',             colour: 'bg-rose-100 text-rose-700' },
  converted:        { label: 'Converted',        dot: 'bg-purple-500',  badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',     colour: 'bg-purple-100 text-purple-700' },
};

export const BQ_STATUS_ORDER: BudgetQuoteStatus[] = [
  'draft', 'pending_approval', 'approved', 'queried', 'sent', 'accepted', 'declined', 'converted',
];

export const BQ_ATTACHMENT_SLOTS: Array<{ field: string; label: string }> = [
  { field: 'onsiteQuoteLink',     label: 'Onsite Quote' },
  { field: 'technicalQuoteLink',  label: 'Technical Quote' },
  { field: 'salesQuoteLink',      label: 'Sales Quote' },
  { field: 'proformaInvoiceLink', label: 'Proforma Invoice' },
  { field: 'customerQuoteLink',   label: 'Customer Quote' },
];
