import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Paperclip, Trash2 } from 'lucide-react';
import { SignatureEditor } from '../proposals/SignatureEditor';
import { BudgetQuote, Client, OrderProduct } from '../../types';
import { BQ_ATTACHMENT_SLOTS } from '../../constants/budgetQuoteConfig';
import { roleBadgeClass } from '@/lib/utils';

interface AssignableUser {
  id: string;
  displayName: string;
  role: string;
}

interface BudgetQuoteFormViewProps {
  initialData?: BudgetQuote | null;
  clients: Client[];
  bdmUsers: Array<{ id: string; displayName: string }>;
  availableUsers: AssignableUser[];
  isAdmin: boolean;
  isUser: boolean;
  isBdm?: boolean;
  isSaving: boolean;
  onBack: () => void;
  onSave: (data: any) => Promise<void>;
}

const BLANK_PRODUCT: OrderProduct = { category: 'sales', name: '', unitCost: 0, quantity: 1, lineTotal: 0 };

export function BudgetQuoteFormView({
  initialData, clients, bdmUsers, availableUsers,
  isAdmin, isUser, isBdm = false, isSaving, onBack, onSave,
}: BudgetQuoteFormViewProps) {
  const isEditing = !!initialData;

  const [clientId, setClientId] = useState(initialData?.clientId ?? '');
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [message, setMessage] = useState(initialData?.message ?? '');
  const [signature, setSignature] = useState(initialData?.signature ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [expiresAt, setExpiresAt] = useState(
    initialData?.expiresAt ? initialData.expiresAt.slice(0, 10) : ''
  );
  const [bdmId, setBdmId] = useState(initialData?.bdmId ?? '');
  const [products, setProducts] = useState<OrderProduct[]>(
    initialData?.products && initialData.products.length > 0
      ? initialData.products
      : [{ ...BLANK_PRODUCT }]
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    (initialData?.assignees ?? []).map(a => a.id)
  );
  const [docs, setDocs] = useState<Record<string, string | null>>(
    Object.fromEntries(BQ_ATTACHMENT_SLOTS.map(s => [s.field, (initialData as any)?.[s.field] ?? null]))
  );
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const docRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const saved = localStorage.getItem('bq_saved_signature');
    if (saved && !initialData?.signature) setSignature(saved);
  }, []);

  const updateProduct = (idx: number, field: keyof OrderProduct, value: string | number) => {
    setProducts(prev => {
      const next = prev.map((p, i) => i === idx ? { ...p, [field]: value } : p);
      if (field === 'unitCost' || field === 'quantity') {
        next[idx].lineTotal = next[idx].unitCost * next[idx].quantity;
      }
      return next;
    });
  };

  const handleNumericChange = (idx: number, field: 'unitCost' | 'quantity', raw: string) => {
    setRawInputs(prev => ({ ...prev, [`${idx}-${field}`]: raw }));
    const num = field === 'unitCost' ? (parseFloat(raw) || 0) : (parseInt(raw) || 1);
    updateProduct(idx, field, num);
  };

  const handleNumericBlur = (idx: number, field: 'unitCost' | 'quantity') => {
    setRawInputs(prev => { const n = { ...prev }; delete n[`${idx}-${field}`]; return n; });
  };

  const handleDocFileChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('File too large — maximum 10 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setDocs(prev => ({ ...prev, [field]: `${file.name}$$$${reader.result}` }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    await onSave({
      clientId,
      title: title.trim() || undefined,
      products,
      notes: notes.trim() || undefined,
      message: message || undefined,
      signature: signature || undefined,
      expiresAt: expiresAt || undefined,
      bdmId: bdmId || undefined,
      assigneeIds,
      ...Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, v ?? undefined])),
    });
    if (signature) localStorage.setItem('bq_saved_signature', signature);
  };

  const isValid = !!clientId && products.some(p => p.name.trim());

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="rounded-xl">← Back</Button>
        <h1 className="text-xl font-bold">{isEditing ? 'Edit Budget Quote' : 'New Budget Quote'}</h1>
      </div>

      <Card className="p-6 space-y-5">
        {/* Client */}
        <div className="space-y-1.5">
          <Label>Client <span className="text-rose-500">*</span></Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select a client…">
                {clientId ? (clients.find(c => c.id === clientId)?.name ?? null) : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label>Title <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            placeholder="e.g. MDM Licensing Estimate Q3"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="rounded-xl"
          />
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <Label>Message to Client</Label>
          <p className="text-xs text-muted-foreground">Don't include a greeting — the email already opens with "Dear [Client Name],". Just write the body of the message.</p>
          <SignatureEditor value={message} onChange={setMessage} placeholder="Please see attached proposal/budgetary quote and documents." />
        </div>

        {/* Account Manager assignment */}
        {(isAdmin || isUser || isBdm) && bdmUsers.length > 0 && (
          <div className="space-y-1.5">
            <Label>Assigned Account Manager <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Select value={bdmId || '__none__'} onValueChange={v => setBdmId(v === '__none__' ? '' : v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {bdmUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Assignees */}
        {availableUsers.length > 0 && (
          <div className="space-y-1.5">
            <Label>Assignees <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="space-y-0.5 max-h-40 overflow-y-auto rounded-xl border border-border bg-muted/30 p-1.5">
              {availableUsers.map(u => (
                <label key={u.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/60 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={assigneeIds.includes(u.id)}
                    onChange={() => setAssigneeIds(prev =>
                      prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                    )}
                    className="rounded"
                  />
                  <span className="text-sm flex-1 truncate">{u.displayName}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${roleBadgeClass(u.role)}`}>
                    {u.role}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Line items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Line Items</Label>
            <Button type="button" variant="outline" size="sm"
              onClick={() => setProducts(prev => [...prev, { ...BLANK_PRODUCT }])}
              className="h-7 text-[10px] rounded-lg gap-1">
              <Plus size={12} /> Add Line
            </Button>
          </div>
          {products.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-muted/20 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                <div className="col-span-2">Category</div>
                <div className="col-span-4">Item</div>
                <div className="col-span-2 text-right">Unit Cost</div>
                <div className="col-span-1 text-center">Qty</div>
                <div className="col-span-2 text-right">Total</div>
                <div className="col-span-1" />
              </div>
              <div className="divide-y divide-border">
                {products.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
                    <div className="col-span-2">
                      <select
                        value={item.category || 'sales'}
                        onChange={e => updateProduct(idx, 'category', e.target.value)}
                        className="h-7 w-full text-xs rounded-lg border border-border bg-background px-1 focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="sales">Sales</option>
                        <option value="tech_product">Tech</option>
                        <option value="device_management">Device Management</option>
                        <option value="training">Training</option>
                      </select>
                    </div>
                    <div className="col-span-4">
                      <Input
                        className="h-7 text-xs rounded-lg border-border"
                        placeholder="Item name"
                        value={item.name}
                        onChange={e => updateProduct(idx, 'name', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        className="h-7 text-xs rounded-lg border-border text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0.00"
                        value={rawInputs[`${idx}-unitCost`] ?? (item.unitCost === 0 ? '' : item.unitCost)}
                        onChange={e => handleNumericChange(idx, 'unitCost', e.target.value)}
                        onBlur={() => handleNumericBlur(idx, 'unitCost')}
                      />
                    </div>
                    <div className="col-span-1">
                      <Input
                        type="number"
                        min="1"
                        className="h-7 text-xs rounded-lg border-border text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={rawInputs[`${idx}-quantity`] ?? item.quantity}
                        onChange={e => handleNumericChange(idx, 'quantity', e.target.value)}
                        onBlur={() => handleNumericBlur(idx, 'quantity')}
                      />
                    </div>
                    <div className="col-span-2 text-right text-xs font-semibold pr-1">
                      R {(item.lineTotal || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setProducts(prev => prev.filter((_, j) => j !== idx))}
                        className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-3 py-2 bg-muted/10 border-t border-border flex justify-end">
                <span className="text-xs font-bold">
                  Total: R {products.reduce((s, p) => s + (p.lineTotal || 0), 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Signature */}
        <div className="space-y-1.5">
          <Label>Signature</Label>
          <SignatureEditor value={signature} onChange={setSignature} />
        </div>

        {/* Expiry */}
        <div className="space-y-1.5">
          <Label>Expiry Date <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            className="rounded-xl"
          />
        </div>

        <Separator />

        {/* Document attachments */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2"><Paperclip size={14} /> Attachments <span className="text-muted-foreground font-normal">(optional)</span></Label>
          {BQ_ATTACHMENT_SLOTS.map(({ field, label }) => {
            const stored = docs[field];
            return (
              <div key={field} className="space-y-1">
                <p className="text-xs text-muted-foreground">{label}</p>
                <input
                  ref={el => { docRefs.current[field] = el; }}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={handleDocFileChange(field)}
                />
                {stored ? (
                  <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-xl px-3 py-2">
                    <Paperclip size={13} className="text-muted-foreground shrink-0" />
                    <span className="text-xs flex-1 truncate">{stored.split('$$$')[0]}</span>
                    <button
                      type="button"
                      onClick={() => setDocs(prev => ({ ...prev, [field]: null }))}
                      className="text-muted-foreground hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => docRefs.current[field]?.click()}
                    className="w-full h-9 rounded-xl gap-2 text-xs text-muted-foreground justify-start">
                    <Paperclip size={13} /> Attach {label.toLowerCase()}...
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label>Internal Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any context or requirements..."
            className="rounded-xl resize-none text-sm"
            rows={3}
          />
        </div>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onBack} className="rounded-xl">Cancel</Button>
        <Button onClick={handleSave} disabled={!isValid || isSaving} className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl gap-2">
          {isSaving ? 'Saving…' : (isEditing ? 'Save Changes' : 'Create Quote')}
        </Button>
      </div>
    </div>
  );
}
