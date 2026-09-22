/**
 * OrderDetailsDialog.tsx — Order Detail & Edit Modal
 *
 * Displays the full details of an order and allows editing by authorised users.
 * Displays eight document attachment slots in the standardised order:
 *   1. Onsite Quote
 *   2. Technical Quote
 *   3. Sales Quote
 *   4. Pro Forma Invoice
 *   5. Customer POP
 *   6. Onsite PO
 *   7. Onsite Tax Invoice
 *   8. Tax Invoice
 */

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, FileText, AlertCircle, Plus, Paperclip, Loader2, XCircle, RotateCcw, Eye, Download } from 'lucide-react';
import { Order, OrderProduct, OrderStatus } from '../../types';
import { WorkflowStep } from '../../hooks/useSteps';
import { openDataUriInNewTab } from '@/lib/utils';

import { ActivityLog } from './ActivityLog';
import { FileUploadField } from './FileUploadField';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderDetailsDialogProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (order: Order) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  formatCurrency: (amount?: number) => string;
  steps: WorkflowStep[];
  isAdmin: boolean;
  isViewer?: boolean;
  isOps?: boolean;
  isUser?: boolean;
  onMove?: (id: string, status: OrderStatus) => Promise<void>;
}

// ─── Attachment Configuration ─────────────────────────────────────────────────

/**
 * Defines the seven document attachment slots in display order.
 * field: the key on the Order type that stores "filename$$$dataUri"
 * label: the human-readable label shown in the UI
 */
const ATTACHMENT_SLOTS: Array<{ field: keyof Order; label: string }> = [
  { field: 'onsiteQuoteLink',          label: 'Onsite Quote' },
  { field: 'technicalQuoteLink',       label: 'Technical Quote' },
  { field: 'salesQuoteLink',           label: 'Sales Quote' },
  { field: 'proformaInvoiceLink',      label: 'Pro Forma Invoice' },
  { field: 'customerPopLink',          label: 'Customer POP' },
  { field: 'onsitePurchaseOrderLink',  label: 'Onsite PO' },
  { field: 'onsiteTaxInvoiceLink',     label: 'Onsite Tax Invoice' },
  { field: 'taxInvoiceLink',           label: 'Tax Invoice' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses a stored document string "filename$$$data:mime;base64,xxx"
 * into a typed object for the FileUploadField component.
 * Returns null if the string is absent or not in the expected format.
 */
function parseStoredFile(raw: string | undefined): { name: string; dataUri: string } | null {
  if (!raw || !raw.includes('$$$')) return null;
  const [name, dataUri] = raw.split('$$$');
  return { name, dataUri };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrderDetailsDialog({
  order: initialOrder,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  formatCurrency,
  steps,
  isAdmin,
  isViewer = false,
  isOps = false,
  isUser = false,
  onMove,
}: OrderDetailsDialogProps) {
  const [localOrder, setLocalOrder] = useState<Order | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [renewStep, setRenewStep] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [isResettingReminders, setIsResettingReminders] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newAttachLabel, setNewAttachLabel] = useState('');
  const customAttachRef = useRef<HTMLInputElement>(null);

  // One ref per attachment slot, keyed by field name, for the hidden file inputs
  const fileRefs = useRef<Partial<Record<keyof Order, React.RefObject<HTMLInputElement>>>>(
    Object.fromEntries(ATTACHMENT_SLOTS.map(s => [s.field, { current: null }]))
  );

  // Sync local state when the order prop changes (i.e. a new order is selected)
  useEffect(() => {
    setLocalOrder(initialOrder);
    setShowDeleteConfirm(false);
    setShowRejectConfirm(false);
    setRenewStep('');
    setShowAddCustom(false);
    setNewAttachLabel('');
  }, [initialOrder?.id]);

  if (!localOrder) return null;

  // ── Derived state ────────────────────────────────────────────────────────────

  const TERMINAL_STATUSES = ['quote_expired', 'quote_rejected'];
  const isTerminalStatus = TERMINAL_STATUSES.includes(localOrder.status);
  const isCompleted = steps.length > 0 && localOrder.status === steps[steps.length - 1].id;
  const canEdit = !isViewer && !isOps && (!isCompleted || isAdmin || isUser) && !isTerminalStatus;
  const canEditDocs = !isViewer && !isTerminalStatus && (!isCompleted || isAdmin);
  // Ops can't edit order details, but they can attach/replace documents — they still
  // need a way to explicitly save & close, since the footer Save button was previously
  // gated on canEdit alone and never appeared for them.
  const canSave = canEdit || (isOps && canEditDocs);
  const computedTotal = (localOrder.products || []).reduce((sum, p) => sum + (p.lineTotal || 0), 0);
  const currentStep = steps.find(s => s.id === localOrder.status);
  const currentStepLabel = isTerminalStatus
    ? (localOrder.status === 'quote_expired' ? 'Quote Expired' : 'Quote Rejected')
    : currentStep?.label ?? localOrder.status;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const patch = (updates: Partial<Order>) =>
    setLocalOrder(prev => prev ? { ...prev, ...updates } : null);

  const addProduct = () => {
    const products = [
      ...(localOrder.products || []),
      { category: localOrder.category, name: '', unitCost: 0, quantity: 1, lineTotal: 0 },
    ] as OrderProduct[];
    patch({ products });
  };

  const updateProduct = (index: number, field: keyof OrderProduct, value: string | number) => {
    const products = [...(localOrder.products || [])];
    const updated = { ...products[index], [field]: value } as OrderProduct;

    // Ensure numeric values are valid
    if (field === 'unitCost' || field === 'quantity') {
      const cost = field === 'unitCost' ? Number(value) : Number(updated.unitCost);
      const qty = field === 'quantity' ? Math.max(1, Number(value)) : Number(updated.quantity);
      updated.unitCost = cost;
      updated.quantity = qty;
      updated.lineTotal = cost * qty;
    }

    products[index] = updated;
    patch({ products, quoteAmount: products.reduce((sum, p) => sum + (p.lineTotal || 0), 0) });
  };

  const handleNumericChange = (idx: number, field: 'unitCost' | 'quantity', raw: string) => {
    setRawInputs(prev => ({ ...prev, [`${idx}-${field}`]: raw }));
    const num = field === 'unitCost' ? (parseFloat(raw) || 0) : (parseInt(raw) || 1);
    updateProduct(idx, field, num);
  };

  const handleNumericBlur = (idx: number, field: 'unitCost' | 'quantity') => {
    setRawInputs(prev => { const n = { ...prev }; delete n[`${idx}-${field}`]; return n; });
  };

  const removeProduct = (index: number) => {
    const products = [...(localOrder.products || [])];
    products.splice(index, 1);
    patch({ products });
  };

  const saveDataImmediate = async (data: Record<string, any>) => {
    const id = localOrder?.firestoreId || localOrder?.id;
    if (!id) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  };

  const saveFieldImmediate = async (field: keyof Order, value: string | null) => {
    await saveDataImmediate({ [field]: value });
  };

  const handleCustomFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!newAttachLabel.trim()) { alert('Please enter a label first'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('File too large — maximum 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const newAtt = { label: newAttachLabel.trim(), file: `${file.name}$$$${reader.result}` };
      const updated = [...(localOrder?.customAttachments || []), newAtt];
      patch({ customAttachments: updated });
      saveDataImmediate({ customAttachments: updated });
      setShowAddCustom(false);
      setNewAttachLabel('');
      if (customAttachRef.current) customAttachRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const removeCustomAttachment = (index: number) => {
    const updated = (localOrder?.customAttachments || []).filter((_, i) => i !== index);
    patch({ customAttachments: updated });
    saveDataImmediate({ customAttachments: updated });
  };

  const handleFileChange = (field: keyof Order) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File too large — maximum 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const value = `${file.name}$$$${reader.result}`;
      patch({ [field]: value });
      saveFieldImmediate(field, value);
    };
    reader.readAsDataURL(file);
  };

  const handleRejectQuote = async () => {
    if (!localOrder || isRejecting || !onMove) return;
    setIsRejecting(true);
    try {
      await onMove(localOrder.firestoreId || localOrder.id, 'quote_rejected' as OrderStatus);
      onClose();
    } finally {
      setIsRejecting(false);
      setShowRejectConfirm(false);
    }
  };

  const handleRenewOrder = async () => {
    if (!localOrder || !renewStep || isRenewing || !onMove) return;
    setIsRenewing(true);
    try {
      await onMove(localOrder.firestoreId || localOrder.id, renewStep as OrderStatus);
      onClose();
    } finally {
      setIsRenewing(false);
    }
  };

  const handleResetReminders = async () => {
    if (!localOrder || isResettingReminders) return;
    setIsResettingReminders(true);
    try {
      const token = localStorage.getItem('token');
      const id = localOrder.firestoreId || localOrder.id;
      const res = await fetch(`/api/orders/${id}/reset-client-reminders`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Client reminder clock reset');
    } catch {
      toast.error('Failed to reset client reminders');
    } finally {
      setIsResettingReminders(false);
    }
  };

  const handleSave = async () => {
    if (!localOrder || isUpdating) return;
    setIsUpdating(true);
    try {
      await onUpdate(localOrder);
      onClose();
    } catch (error) {
      console.error('Failed to update order:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = () => onDelete(localOrder.firestoreId || localOrder.id).then(onClose);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[650px] rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0 flex flex-col h-[90vh] max-h-[90vh]">

        {/* ── Header ── */}
        <div className="p-8 bg-slate-50/50 dark:bg-muted/20 border-b border-border shrink-0">
          <DialogHeader>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground tracking-[0.2em] uppercase">{localOrder.id}</span>
                <Badge variant="outline" className="text-[9px] font-bold text-indigo-400 border-indigo-100 rounded-full">
                  {localOrder.category.toUpperCase()}
                </Badge>
              </div>
              {canEdit && (
                showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-rose-500 uppercase">Confirm?</span>
                    <Button variant="ghost" size="sm" onClick={handleDelete} className="h-7 text-rose-600 font-bold px-2 rounded-lg">Delete</Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)} className="h-7 text-muted-foreground font-bold px-2 rounded-lg">Cancel</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="icon" onClick={() => setShowDeleteConfirm(true)} className="text-muted-foreground/40 hover:text-rose-500 rounded-full h-8 w-8">
                    <Trash2 size={16} />
                  </Button>
                )
              )}
            </div>
            <DialogTitle className="text-3xl font-bold tracking-tight">{localOrder.clientName}</DialogTitle>
            <div className="mt-4 flex items-center gap-6 flex-wrap">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Stage</span>
                <span className={`text-sm font-bold ${isTerminalStatus ? 'text-orange-500' : 'text-primary'}`}>{currentStepLabel}</span>
                {!isTerminalStatus && currentStep?.clientReminderEnabled && !isViewer && (
                  <button
                    onClick={handleResetReminders}
                    disabled={isResettingReminders}
                    className="text-[10px] text-amber-600 hover:underline disabled:opacity-50 text-left"
                  >
                    {isResettingReminders ? 'Resetting...' : 'Reset Client Reminders'}
                  </button>
                )}
              </div>
              <div className="flex flex-col ml-auto">
                <span className="text-[10px] font-bold text-muted-foreground uppercase text-right">Order Total</span>
                <span className="text-lg font-black text-primary">{formatCurrency(computedTotal)}</span>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">

          {/* Renewal section for terminal orders */}
          {isTerminalStatus && (isAdmin || isUser) && onMove && (
            <section className="space-y-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4">
              <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                <RotateCcw size={14} /> Renew Order
              </h4>
              <p className="text-xs text-muted-foreground">Move this order back to an active step to resume processing.</p>
              <select
                value={renewStep}
                onChange={e => setRenewStep(e.target.value)}
                className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select step...</option>
                {steps.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <Button
                onClick={handleRenewOrder}
                disabled={!renewStep || isRenewing}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl h-9 text-sm"
              >
                {isRenewing ? <><Loader2 size={14} className="mr-2 animate-spin" />Renewing...</> : 'Confirm Renew'}
              </Button>
            </section>
          )}

          {/* Internal Notes */}
          <section className="space-y-4">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <AlertCircle size={14} /> Internal Notes
            </h4>
            <textarea
              className="min-h-[100px] w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm focus:outline-none disabled:opacity-50"
              value={localOrder.notes || ''}
              disabled={!canEdit}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="Add internal notes..."
            />
          </section>

          {/* Products */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <FileText size={14} /> Products
              </h4>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={addProduct} className="h-7 text-[10px] rounded-lg gap-1">
                  <Plus size={12} /> Add Line
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-3 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                <div className="col-span-1">Qty</div>
                <div className="col-span-2">Cat</div>
                <div className="col-span-5">Item Description</div>
                <div className="col-span-2 text-right">Unit Cost</div>
                <div className="col-span-2 text-right">Total</div>
              </div>

              <div className="space-y-2">
                {(localOrder.products || []).map((p, i) => (
                  <div key={i} className="group bg-slate-50/50 dark:bg-muted/10 border border-border p-2 rounded-xl relative">
                    {canEdit && (
                      <Button variant="ghost" size="icon"
                        onClick={() => removeProduct(i)}
                        className="absolute -left-2 top-1/2 -translate-y-1/2 h-6 w-6 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                      </Button>
                    )}
                    <div className="grid grid-cols-12 gap-2 items-center">
                      {/* Quantity */}
                      <div className="col-span-1">
                        <Input
                          type="number"
                          min="1"
                          className="h-8 text-xs font-bold rounded-lg px-2 text-center bg-transparent border-none focus-visible:ring-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={rawInputs[`${i}-quantity`] ?? p.quantity}
                          disabled={!canEdit}
                          onChange={(e) => handleNumericChange(i, 'quantity', e.target.value)}
                          onBlur={() => handleNumericBlur(i, 'quantity')}
                        />
                      </div>
                      {/* Category */}
                      <div className="col-span-2">
                        <select
                          value={p.category || 'device_management'}
                          disabled={!canEdit}
                          onChange={e => updateProduct(i, 'category', e.target.value)}
                          className="h-8 w-full text-xs rounded-lg border border-border bg-transparent px-1 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 cursor-pointer"
                        >
                          <option value="device_management">Device Management</option>
                          <option value="tech_product">Tech</option>
                          <option value="sales">Sales</option>
                          <option value="training">Training</option>
                        </select>
                      </div>
                      {/* Name */}
                      <div className="col-span-5">
                        <Input
                          className="h-8 text-xs rounded-lg bg-transparent border-none focus-visible:ring-1"
                          value={p.name}
                          disabled={!canEdit}
                          onChange={(e) => updateProduct(i, 'name', e.target.value)}
                          placeholder="Item name"
                        />
                      </div>
                      {/* Unit Cost */}
                      <div className="col-span-2">
                        <Input
                          type="number"
                          className="h-8 text-xs rounded-lg px-2 text-right bg-transparent border-none focus-visible:ring-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={rawInputs[`${i}-unitCost`] ?? (p.unitCost === 0 ? '' : p.unitCost)}
                          disabled={!canEdit}
                          onChange={(e) => handleNumericChange(i, 'unitCost', e.target.value)}
                          onBlur={() => handleNumericBlur(i, 'unitCost')}
                          placeholder="0.00"
                        />
                      </div>
                      {/* Line Total */}
                      <div className="col-span-2 text-right px-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          {formatCurrency(p.lineTotal || (p.unitCost * p.quantity))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Section */}
              {(localOrder.products || []).length > 0 && (
                <div className="mt-4 pt-4 border-t border-dashed border-border flex justify-end">
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Items Subtotal</span>
                    <span className="text-xl font-black text-primary">
                      {formatCurrency(computedTotal)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Attachments (7 slots in standardised order) ── */}
          <section className="space-y-4">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Paperclip size={14} /> Attachments
            </h4>
            <div className="grid gap-4">
              {ATTACHMENT_SLOTS.map(({ field, label }) => {
                // Lazily initialise a ref for each upload input
                if (!fileRefs.current[field]) {
                  fileRefs.current[field] = { current: null };
                }
                return (
                  <FileUploadField
                    key={field}
                    label={label}
                    storedFile={parseStoredFile(localOrder[field] as string | undefined)}
                    isPlainUrl={false}
                    canEdit={canEditDocs}
                    inputRef={fileRefs.current[field] as React.RefObject<HTMLInputElement>}
                    onChange={handleFileChange(field)}
                    onClear={() => { patch({ [field]: '' }); saveFieldImmediate(field, null); }}
                  />
                );
              })}
            </div>
          </section>

          {/* Custom Attachments */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Paperclip size={14} /> Custom Attachments
              </h4>
              {canEditDocs && !showAddCustom && (
                <Button size="sm" variant="outline"
                  onClick={() => setShowAddCustom(true)}
                  className="h-7 text-[10px] rounded-lg gap-1">
                  <Plus size={12} /> Add
                </Button>
              )}
            </div>
            <div className="grid gap-3">
              {(localOrder.customAttachments || []).map((att, i) => {
                const [filename, dataUri] = att.file.split('$$$');
                return (
                  <div key={i} className="flex items-center gap-2 bg-muted/40 border border-border rounded-xl px-3 py-2">
                    <Paperclip size={13} className="text-muted-foreground shrink-0" />
                    <span className="text-xs font-semibold text-muted-foreground mr-1 shrink-0">{att.label}:</span>
                    <span className="text-xs flex-1 truncate text-muted-foreground">{filename}</span>
                    <button type="button" onClick={() => openDataUriInNewTab(dataUri)}
                      className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/80 uppercase tracking-widest shrink-0">
                      <Eye size={12} /> View
                    </button>
                    <a href={dataUri} download={filename}
                      className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest shrink-0">
                      <Download size={12} /> Download
                    </a>
                    {canEditDocs && (
                      <button onClick={() => removeCustomAttachment(i)}
                        className="text-muted-foreground hover:text-rose-500 transition-colors shrink-0">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
              {showAddCustom && canEditDocs && (
                <div className="flex items-center gap-2 bg-muted/20 border border-dashed border-border rounded-xl p-2">
                  <Input
                    placeholder="Label (e.g. Site Survey)"
                    value={newAttachLabel}
                    onChange={e => setNewAttachLabel(e.target.value)}
                    className="h-8 text-xs rounded-lg flex-1"
                  />
                  <Button size="sm" variant="outline"
                    onClick={() => { if (!newAttachLabel.trim()) { alert('Enter a label first'); return; } customAttachRef.current?.click(); }}
                    className="h-8 text-xs rounded-lg gap-1 shrink-0">
                    <Paperclip size={12} /> File
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => { setShowAddCustom(false); setNewAttachLabel(''); }}
                    className="h-8 text-xs rounded-lg text-muted-foreground shrink-0">
                    Cancel
                  </Button>
                  <input ref={customAttachRef} type="file" className="hidden" onChange={handleCustomFileChange} />
                </div>
              )}
            </div>
          </section>

          {/* Activity Log */}
          <ActivityLog audits={localOrder.audits || []} steps={steps} />
        </div>

        {/* ── Footer ── */}
        <div className="p-8 bg-card border-t border-border flex justify-end items-center gap-4 shrink-0 flex-wrap">
          {/* Reject Quote — admin only, active non-terminal orders */}
          {(isAdmin || isUser) && !isTerminalStatus && !isCompleted && onMove && (
            showRejectConfirm ? (
              <div className="flex items-center gap-2 mr-auto">
                <span className="text-[10px] font-bold text-orange-500 uppercase">Reject Quote?</span>
                <Button variant="ghost" size="sm" onClick={handleRejectQuote} disabled={isRejecting}
                  className="h-7 text-orange-600 font-bold px-2 rounded-lg">
                  {isRejecting ? 'Rejecting...' : 'Confirm'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowRejectConfirm(false)}
                   className="h-7 text-muted-foreground font-bold px-2 rounded-lg">Cancel</Button>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setShowRejectConfirm(true)}
                className="mr-auto text-orange-500 hover:text-orange-600 hover:bg-orange-500/10 rounded-xl text-xs gap-1">
                <XCircle size={14} /> Reject Quote
              </Button>
            )
          )}
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancel</Button>
          {canSave && (
            <Button
              onClick={handleSave}
              disabled={isUpdating}
              className="bg-primary text-white rounded-xl px-8 shadow-lg min-w-[140px]"
            >
              {isUpdating ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Saving...
                </>
              ) : 'Save Changes'}
            </Button>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
