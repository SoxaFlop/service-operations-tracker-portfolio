/**
 * NewOrderDialog.tsx — Create New Order Modal
 *
 * Allows users to create a new order with:
 *   - Client selection
 *   - Product lines (name, category, unit cost, quantity)
 *   - Optional document attachments for all seven slot types
 *
 * Documents are stored as "filename$$$data:base64..." strings and
 * passed to the createOrder API, which stores them in the database.
 */

import { useState, useRef, useCallback } from 'react';
import { Plus, Trash2, Paperclip, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Order, OrderProduct, Client } from '../../types';
import { FileUploadField } from './FileUploadField';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewOrderDialogProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  createOrder: (order: Partial<Order>) => Promise<boolean>;
  clients: Client[];
}

// ─── Attachment Configuration ─────────────────────────────────────────────────

/**
 * Seven document slots available when creating a new order.
 * Matches the order defined in OrderDetailsDialog for consistency.
 */
const ATTACHMENT_SLOTS: Array<{ field: keyof Order; label: string }> = [
  { field: 'onsiteQuoteLink', label: 'Onsite Quote' },
  { field: 'technicalQuoteLink', label: 'Technical Quote' },
  { field: 'salesQuoteLink', label: 'Sales Quote' },
  { field: 'proformaInvoiceLink', label: 'Pro Forma Invoice' },
  { field: 'customerPopLink', label: 'Customer POP' },
  { field: 'onsitePurchaseOrderLink', label: 'Onsite PO' },
  { field: 'onsiteTaxInvoiceLink', label: 'Onsite Tax Invoice' },
  { field: 'taxInvoiceLink', label: 'Tax Invoice' },
];

// ─── Default State ────────────────────────────────────────────────────────────

const DEFAULT_ORDER: Partial<Order> = {
  category: 'device_management',
  products: [{ category: 'device_management', name: '', unitCost: 0, quantity: 1, lineTotal: 0 }],
};

// ─── Component ────────────────────────────────────────────────────────────────

export function NewOrderDialog({ isOpen, setIsOpen, createOrder, clients }: NewOrderDialogProps) {
  const [newOrder, setNewOrder] = useState<Partial<Order>>(DEFAULT_ORDER);
  const [showAttachments, setShowAttachments] = useState(false);
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);

  // One hidden file input ref per attachment slot
  const fileRefs = useRef<Partial<Record<keyof Order, React.RefObject<HTMLInputElement>>>>(
    Object.fromEntries(ATTACHMENT_SLOTS.map(s => [s.field, { current: null }]))
  );

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const patch = (updates: Partial<Order>) =>
    setNewOrder(prev => ({ ...prev, ...updates }));

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    const total = (newOrder.products || []).reduce((sum, p) => sum + (p.lineTotal || 0), 0);
    const resolvedCategory = newOrder.products?.[0]?.category || 'device_management';
    const success = await createOrder({ ...newOrder, category: resolvedCategory, quoteAmount: total });
    if (success) {
      setIsOpen(false);
      setNewOrder(DEFAULT_ORDER);
      setShowAttachments(false);
      setRawInputs({});
    }
    setIsCreating(false);
  };

  const handleNumericChange = (idx: number, field: 'unitCost' | 'quantity', raw: string) => {
    setRawInputs(prev => ({ ...prev, [`${idx}-${field}`]: raw }));
    const num = field === 'unitCost' ? (parseFloat(raw) || 0) : (parseInt(raw) || 1);
    updateProduct(idx, field, num);
  };

  const handleNumericBlur = (idx: number, field: 'unitCost' | 'quantity') => {
    setRawInputs(prev => { const n = { ...prev }; delete n[`${idx}-${field}`]; return n; });
  };

  const addProduct = () =>
    patch({
      products: [
        ...(newOrder.products || []),
        { category: newOrder.category === 'tech_product' ? 'tech_product' : 'device_management', name: '', unitCost: 0, quantity: 1, lineTotal: 0 },
      ],
    });

  const updateProduct = (index: number, field: keyof OrderProduct, value: string | number) => {
    const products = [...(newOrder.products || [])];
    products[index] = { ...products[index], [field]: value };
    if (field === 'unitCost' || field === 'quantity') {
      products[index].lineTotal = products[index].unitCost * products[index].quantity;
    }
    patch({ products });
  };

  const removeProduct = (index: number) => {
    const products = [...(newOrder.products || [])];
    products.splice(index, 1);
    patch({ products });
  };

  const handleFileChange = (field: keyof Order) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File too large — maximum 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => patch({ [field]: `${file.name}$$$${reader.result}` });
    reader.readAsDataURL(file);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 gap-2 rounded-xl h-9" />
        }
      >
        <Plus size={18} /> New Order
      </DialogTrigger>

      <DialogContent className="sm:max-w-[540px] rounded-3xl border-none shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0 p-6 pb-4 border-b border-border">
          <DialogTitle className="text-xl font-bold">New Order Entry</DialogTitle>
          <DialogDescription>Initialize a new procurement order in the tracker.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── Client Selector ── */}
          <div className="grid gap-2">
            <Label className="text-xs font-bold text-muted-foreground uppercase">Client</Label>
            <Select
              value={newOrder.clientId || ''}
              onValueChange={(v) => {
                const c = clients.find(cl => cl.id === v);
                patch({ clientId: v, clientName: c?.name || '' });
              }}
            >
              <SelectTrigger className="rounded-xl bg-muted/30 border-border">
                <SelectValue placeholder="Select a client...">
                  {clients.find(c => c.id === newOrder.clientId)?.name || undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border">
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Product Lines ── */}
          <div className="grid gap-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Products</Label>
              <Button type="button" variant="outline" size="sm" onClick={addProduct} className="h-7 text-[10px] rounded-lg">
                <Plus size={12} className="mr-1" /> Add Product
              </Button>
            </div>
            <div className="space-y-3">
              {(newOrder.products || []).map((product, idx) => (
                <div key={idx} className="bg-slate-50/50 dark:bg-muted/10 border border-border p-3 rounded-xl relative space-y-3">
                  {(newOrder.products?.length || 0) > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeProduct(idx)}
                      className="absolute top-1 right-1 h-6 w-6 text-red-500/70 hover:text-red-500 hover:bg-red-500/10 rounded-lg">
                      <Trash2 size={12} />
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-3 pr-6">
                    {/* Category */}
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Category</Label>
                      <Select value={product.category || newOrder.category} onValueChange={(v) => updateProduct(idx, 'category', v)}>
                        <SelectTrigger className="h-8 text-xs bg-white dark:bg-muted/30 border-slate-200 dark:border-border rounded-lg">
                          <SelectValue placeholder="Category">
                            {(product.category || newOrder.category) === 'tech_product' ? 'Tech Services' : (product.category || newOrder.category) === 'sales' ? 'Sales' : (product.category || newOrder.category) === 'training' ? 'Training' : 'Device Management'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border">
                          <SelectItem value="device_management" className="text-xs">Device Management</SelectItem>
                          <SelectItem value="tech_product" className="text-xs">Tech Services</SelectItem>
                          <SelectItem value="sales" className="text-xs">Sales</SelectItem>
                          <SelectItem value="training" className="text-xs">Training Services</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Item Name */}
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Item Name</Label>
                      <Input placeholder="e.g. iPad Pro" className="h-8 text-sm bg-white dark:bg-muted/30 border-slate-200 dark:border-border rounded-lg"
                        value={product.name} onChange={(e) => updateProduct(idx, 'name', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Unit Cost */}
                    <div className="grid gap-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Unit Cost (R)</Label>
                      <Input type="number" min="0" step="0.01"
                        className="h-8 text-sm bg-white dark:bg-muted/30 border-slate-200 dark:border-border rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={rawInputs[`${idx}-unitCost`] ?? (product.unitCost === 0 ? '' : product.unitCost)}
                        onChange={(e) => handleNumericChange(idx, 'unitCost', e.target.value)}
                        onBlur={() => handleNumericBlur(idx, 'unitCost')} />
                    </div>
                    {/* Qty */}
                    <div className="grid gap-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Qty</Label>
                      <Input type="number" min="1"
                        className="h-8 text-sm bg-white dark:bg-muted/30 border-slate-200 dark:border-border rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={rawInputs[`${idx}-quantity`] ?? product.quantity}
                        onChange={(e) => handleNumericChange(idx, 'quantity', e.target.value)}
                        onBlur={() => handleNumericBlur(idx, 'quantity')} />
                    </div>
                    {/* Total */}
                    <div className="grid gap-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Total</Label>
                      <div className="flex items-center h-8 font-medium text-sm text-slate-700 dark:text-slate-300">
                        R {product.lineTotal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Grand Total Summary */}
            {(newOrder.products || []).length > 0 && (
              <div className="mt-2 pt-4 border-t border-dashed border-border flex justify-end">
                <div className="space-y-1 text-right">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Estimated Total</span>
                  <span className="text-xl font-black text-indigo-500">
                    R {newOrder.products!.reduce((sum, p) => sum + (p.lineTotal || 0), 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Attachments (collapsible) ── */}
          <div className="border border-border rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAttachments(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-widest hover:bg-muted/20 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Paperclip size={13} /> Attachments (optional)
              </span>
              {showAttachments ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showAttachments && (
              <div className="grid gap-4 p-4 border-t border-border bg-muted/10">
                {ATTACHMENT_SLOTS.map(({ field, label }) => {
                  if (!fileRefs.current[field]) {
                    fileRefs.current[field] = { current: null };
                  }
                  return (
                    <FileUploadField
                      key={field}
                      label={label}
                      storedFile={
                        newOrder[field] && (newOrder[field] as string).includes('$$$')
                          ? (() => { const [name, dataUri] = (newOrder[field] as string).split('$$$'); return { name, dataUri }; })()
                          : null
                      }
                      isPlainUrl={false}
                      canEdit={true}
                      inputRef={fileRefs.current[field] as React.RefObject<HTMLInputElement>}
                      onChange={handleFileChange(field)}
                      onClear={() => patch({ [field]: '' })}
                    />
                  );
                })}
              </div>
            )}
          </div>

        </div>

        <DialogFooter className="gap-2 p-6 pt-4 shrink-0 border-t border-border">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={handleCreate} disabled={isCreating} className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl px-6 shadow-md shadow-indigo-500/20">
            {isCreating ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
