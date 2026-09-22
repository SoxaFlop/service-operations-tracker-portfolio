import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Loader2, Paperclip, X } from 'lucide-react';
import { BudgetQuote, Client, OrderProduct } from '../../types';

interface NewBudgetQuoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<BudgetQuote>) => Promise<void>;
  clients: Client[];
  initialData?: BudgetQuote | null;
  bdmUsers?: Array<{ id: string; displayName: string }>;
  currentUserId?: string;
  isAdmin?: boolean;
  isUser?: boolean;
}

const BLANK_PRODUCT: OrderProduct = { category: 'sales', name: '', unitCost: 0, quantity: 1, lineTotal: 0 };

export function NewBudgetQuoteDialog({
  isOpen, onClose, onSave, clients,
  initialData, bdmUsers, currentUserId, isAdmin, isUser,
}: NewBudgetQuoteDialogProps) {
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [products, setProducts] = useState<OrderProduct[]>([{ ...BLANK_PRODUCT }]);
  const [notes, setNotes] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [bdmId, setBdmId] = useState('');
  const [technicalQuoteLink, setTechnicalQuoteLink] = useState<string | null>(null);
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setClientId(initialData.clientId);
        setTitle(initialData.title ?? '');
        setProducts(initialData.products.length > 0 ? initialData.products : [{ ...BLANK_PRODUCT }]);
        setNotes(initialData.notes ?? '');
        setTechnicalQuoteLink(initialData.technicalQuoteLink ?? null);
        setExpiresAt(initialData.expiresAt ? initialData.expiresAt.slice(0, 10) : '');
        setBdmId(initialData.bdmId ?? '');
      } else {
        setClientId('');
        setTitle('');
        setProducts([{ ...BLANK_PRODUCT }]);
        setNotes('');
        setTechnicalQuoteLink(null);
        setExpiresAt('');
        setBdmId('');
      }
      setRawInputs({});
    }
  }, [isOpen, initialData]);

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

  const addProduct = () => setProducts(prev => [...prev, { ...BLANK_PRODUCT }]);

  const removeProduct = (idx: number) => setProducts(prev => prev.filter((_, i) => i !== idx));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('File too large — maximum 10 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setTechnicalQuoteLink(`${file.name}$$$${reader.result}`);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!clientId) return;
    setIsSaving(true);
    await onSave({
      clientId,
      title: title.trim() || undefined,
      products,
      notes: notes.trim() || undefined,
      technicalQuoteLink: technicalQuoteLink ?? undefined,
      expiresAt: expiresAt || undefined,
      bdmId: bdmId || undefined,
    });
    setIsSaving(false);
  };

  const canEdit = isAdmin || isUser;
  const total = products.reduce((s, p) => s + (p.lineTotal || 0), 0);
  const isValid = !!clientId && products.some(p => p.name.trim());

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[540px] rounded-3xl border-none shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0 p-6 pb-4 border-b border-border">
          <DialogTitle className="text-xl font-bold">
            {initialData ? 'Edit Budget Quote' : 'New Budget Quote'}
          </DialogTitle>
          <DialogDescription>
            {initialData ? 'Update the details for this budget quote.' : 'Create a budget estimate for a client.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Client */}
          <div className="grid gap-2">
            <Label>Client <span className="text-rose-500">*</span></Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select a client...">
                  {clients.find(c => c.id === clientId)?.name || undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="grid gap-2">
            <Label>Title <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. MDM Licensing Estimate Q3"
              className="rounded-xl"
            />
          </div>

          {/* Account Manager assignment — admin/user only */}
          {(isAdmin || isUser) && bdmUsers && bdmUsers.length > 0 && (
            <div className="grid gap-2">
              <Label>Assigned Account Manager <span className="text-muted-foreground text-xs">(optional)</span></Label>
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

          {/* Product lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Products</Label>
              <Button variant="ghost" size="sm" onClick={addProduct} className="h-7 text-xs gap-1 text-primary hover:bg-primary/10 rounded-lg">
                <Plus size={12} /> Add Line
              </Button>
            </div>

            {products.map((p, idx) => (
              <div key={idx} className="bg-muted/30 border border-border/50 rounded-2xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Product name"
                    value={p.name}
                    onChange={e => updateProduct(idx, 'name', e.target.value)}
                    className="flex-1 h-8 text-sm rounded-lg"
                  />
                  {products.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeProduct(idx)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500 rounded-lg shrink-0">
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Unit Cost (R)</p>
                    <Input
                      type="number"
                      min="0"
                      value={rawInputs[`${idx}-unitCost`] ?? (p.unitCost === 0 ? '' : p.unitCost)}
                      onChange={e => handleNumericChange(idx, 'unitCost', e.target.value)}
                      onBlur={() => handleNumericBlur(idx, 'unitCost')}
                      placeholder="0"
                      className="h-8 text-sm rounded-lg"
                    />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Qty</p>
                    <Input
                      type="number"
                      min="1"
                      value={rawInputs[`${idx}-quantity`] ?? p.quantity}
                      onChange={e => handleNumericChange(idx, 'quantity', e.target.value)}
                      onBlur={() => handleNumericBlur(idx, 'quantity')}
                      className="h-8 text-sm rounded-lg"
                    />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Line Total</p>
                    <div className="h-8 flex items-center text-sm font-bold text-foreground px-2 bg-muted/50 rounded-lg border border-border/50">
                      R {p.lineTotal.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-end">
              <span className="text-sm font-bold">
                Total: R {total.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Expiry */}
          <div className="grid gap-2">
            <Label>Expiry Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* Technical Quote attachment */}
          <div className="grid gap-2">
            <Label>Technical Quote <span className="text-muted-foreground text-xs">(optional — PDF or image)</span></Label>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFileChange} />
            {technicalQuoteLink ? (
              <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-xl px-3 py-2">
                <Paperclip size={13} className="text-muted-foreground shrink-0" />
                <span className="text-xs text-foreground flex-1 truncate">
                  {technicalQuoteLink.split('$$$')[0]}
                </span>
                <button onClick={() => setTechnicalQuoteLink(null)} className="text-muted-foreground hover:text-rose-500 transition-colors">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}
                className="w-full h-9 rounded-xl gap-2 text-xs text-muted-foreground justify-start">
                <Paperclip size={13} /> Attach technical quote...
              </Button>
            )}
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any context or requirements..."
              className="rounded-xl resize-none text-sm"
              rows={3}
            />
          </div>
        </div>

        <div className="shrink-0 p-6 pt-4 border-t border-border flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1 rounded-xl" disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid || isSaving}
            className="flex-1 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
          >
            {isSaving ? <><Loader2 size={14} className="animate-spin mr-1" /> Saving...</> : (initialData ? 'Save Changes' : 'Create Quote')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
