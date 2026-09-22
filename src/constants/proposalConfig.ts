export const STATUS_CONFIG: Record<string, { label: string; colour: string; dot: string; badge: string }> = {
  draft:            { label: 'Draft',                          colour: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',   dot: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  pending_approval: { label: 'Pending Approval',               colour: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  approved:         { label: 'Approved',                       colour: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  sent:             { label: 'Sent',                           colour: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',    dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  queried:          { label: 'Queried',                        colour: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300', dot: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  rejected:         { label: 'Queried',                        colour: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300', dot: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  declined:         { label: 'Declined',                       colour: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', dot: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
};

export const PROPOSAL_STATUS_ORDER = ['draft', 'pending_approval', 'approved', 'sent', 'queried', 'declined'];

export const PROPOSAL_DOC_FIELDS: Array<{ field: string; label: string }> = [
  { field: 'technicalQuoteLink',      label: 'Technical Quote' },
  { field: 'salesQuoteLink',          label: 'Sales Quote' },
  { field: 'proformaInvoiceLink',     label: 'Pro Forma Invoice' },
  { field: 'taxInvoiceLink',          label: 'Tax Invoice' },
  { field: 'onsiteQuoteLink',         label: 'Onsite Quote' },
  { field: 'customerQuoteLink',       label: 'Customer Quote' },
  { field: 'customerPopLink',         label: 'Customer POP' },
  { field: 'onsitePurchaseOrderLink', label: 'Onsite PO' },
  { field: 'onsiteTaxInvoiceLink',    label: 'Onsite Tax Invoice' },
];

/** @deprecated Use STATUS_CONFIG directly */
export const KANBAN_COLUMNS: Array<{ status: string; label: string; dot: string }> = [
  { status: 'draft',            label: 'Draft',            dot: 'bg-slate-400' },
  { status: 'pending_approval', label: 'Pending Approval', dot: 'bg-amber-400' },
  { status: 'approved',         label: 'Approved',         dot: 'bg-green-500' },
  { status: 'sent',             label: 'Sent to Client',   dot: 'bg-blue-500' },
  { status: 'queried',          label: 'Queried',          dot: 'bg-yellow-400' },
  { status: 'declined',         label: 'Declined',         dot: 'bg-orange-400' },
];

export const ORDER_DOC_OPTIONS: Array<{ field: string; label: string }> = [
  { field: 'technicalQuoteLink',  label: 'Technical Quote' },
  { field: 'salesQuoteLink',      label: 'Sales Quote' },
  { field: 'proformaInvoiceLink', label: 'Pro Forma Invoice' },
  { field: 'taxInvoiceLink',      label: 'Tax Invoice' },
  { field: 'onsiteQuoteLink',     label: 'Onsite Quote' },
];
