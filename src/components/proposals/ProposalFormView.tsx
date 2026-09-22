import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, FileText, Paperclip, Trash2 } from 'lucide-react';
import { SignatureEditor } from './SignatureEditor';
import { PROPOSAL_DOC_FIELDS } from '../../constants/proposalConfig';
import { Client, OrderProduct } from '../../types';
import { AssignableUser } from '../../hooks/useProposalForm';
import { roleBadgeClass } from '@/lib/utils';

interface ProposalFormViewProps {
  form: { title: string; clientId: string; message: string; signature: string; expiresAt: string };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  proposalDocs: Record<string, string>;
  proposalProducts: OrderProduct[];
  setProposalProducts: React.Dispatch<React.SetStateAction<OrderProduct[]>>;
  productRawInputs: Record<string, string>;
  assigneeIds: string[];
  setAssigneeIds: React.Dispatch<React.SetStateAction<string[]>>;
  availableUsers: AssignableUser[];
  clients: Client[];
  isEditing: boolean;
  isSaving: boolean;
  onBack: () => void;
  onSave: () => void;
  addProposalProduct: () => void;
  updateProposalProduct: (idx: number, field: keyof OrderProduct, value: string | number) => void;
  handleProductNumericChange: (idx: number, field: 'unitCost' | 'quantity', raw: string) => void;
  handleProductNumericBlur: (idx: number, field: 'unitCost' | 'quantity') => void;
  handleDocFileUpload: (field: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  clearDocFile: (field: string) => void;
}

export function ProposalFormView({
  form, setForm,
  proposalDocs,
  proposalProducts, setProposalProducts,
  productRawInputs,
  assigneeIds, setAssigneeIds,
  availableUsers,
  clients,
  isEditing, isSaving,
  onBack, onSave,
  addProposalProduct, updateProposalProduct,
  handleProductNumericChange, handleProductNumericBlur,
  handleDocFileUpload, clearDocFile,
}: ProposalFormViewProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="rounded-xl">← Back</Button>
        <h1 className="text-xl font-bold">{isEditing ? 'Edit Proposal' : 'New Proposal'}</h1>
      </div>

      <Card className="p-6 space-y-5">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input
            placeholder="e.g. iPad Fleet Proposal — Q3 2026"
            value={form.title}
            onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Client</Label>
          <Select value={form.clientId} onValueChange={v => setForm((f: any) => ({ ...f, clientId: v }))}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select a client…">
                {form.clientId
                  ? (clients.find(c => c.id === form.clientId)?.name ?? <span className="text-muted-foreground">Select a client…</span>)
                  : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Message to Client</Label>
          <p className="text-xs text-muted-foreground">Don't include a greeting — the email already opens with "Dear [Client Name],". Just write the body of the message.</p>
          <SignatureEditor
            value={form.message}
            onChange={msg => setForm((f: any) => ({ ...f, message: msg }))}
            placeholder="Please see attached proposal/budgetary quote and documents."
          />
        </div>

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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2"><FileText size={14} /> Line Items</Label>
            <Button type="button" variant="outline" size="sm" onClick={addProposalProduct} className="h-7 text-[10px] rounded-lg gap-1">
              <Plus size={12} /> Add Line
            </Button>
          </div>
          {proposalProducts.length > 0 && (
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
                {proposalProducts.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
                    <div className="col-span-2">
                      <select
                        value={item.category || 'sales'}
                        onChange={e => updateProposalProduct(idx, 'category', e.target.value)}
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
                        onChange={e => updateProposalProduct(idx, 'name', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        className="h-7 text-xs rounded-lg border-border text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0.00"
                        value={productRawInputs[`${idx}-unitCost`] ?? (item.unitCost === 0 ? '' : item.unitCost)}
                        onChange={e => handleProductNumericChange(idx, 'unitCost', e.target.value)}
                        onBlur={() => handleProductNumericBlur(idx, 'unitCost')}
                      />
                    </div>
                    <div className="col-span-1">
                      <Input
                        type="number"
                        min="1"
                        className="h-7 text-xs rounded-lg border-border text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={productRawInputs[`${idx}-quantity`] ?? item.quantity}
                        onChange={e => handleProductNumericChange(idx, 'quantity', e.target.value)}
                        onBlur={() => handleProductNumericBlur(idx, 'quantity')}
                      />
                    </div>
                    <div className="col-span-2 text-right text-xs font-semibold pr-1">
                      R {(item.lineTotal || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setProposalProducts(prev => prev.filter((_, j) => j !== idx))}
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
                  Total: R {proposalProducts.reduce((s, p) => s + (p.lineTotal || 0), 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Signature</Label>
          <SignatureEditor
            value={form.signature}
            onChange={sig => setForm((f: any) => ({ ...f, signature: sig }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Proposal Expiry Date <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            type="date"
            value={form.expiresAt}
            onChange={e => setForm((f: any) => ({ ...f, expiresAt: e.target.value }))}
            className="rounded-xl"
          />
        </div>

        <Separator />

        <div className="space-y-3">
          <Label className="flex items-center gap-2"><Paperclip size={14} /> Attachments</Label>
          <div className="space-y-2">
            {PROPOSAL_DOC_FIELDS.map(({ field, label }) => {
              const raw = proposalDocs[field];
              const filename = raw?.split('$$$')[0];
              return (
                <div key={field} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-44 shrink-0">{label}</span>
                  {filename ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0 bg-muted rounded-lg px-2.5 py-1.5">
                      <Paperclip size={11} className="text-muted-foreground shrink-0" />
                      <span className="text-xs truncate flex-1">{filename}</span>
                      <button
                        type="button"
                        onClick={() => clearDocFile(field)}
                        className="text-muted-foreground hover:text-destructive shrink-0 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-primary/50 rounded-lg px-2.5 py-1.5 transition-colors">
                      <Plus size={12} /> Attach
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={e => handleDocFileUpload(field, e)}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onBack} className="rounded-xl">Cancel</Button>
        <Button onClick={onSave} disabled={isSaving} className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl gap-2">
          {isSaving ? 'Saving…' : (isEditing ? 'Save Changes' : 'Create Proposal')}
        </Button>
      </div>
    </div>
  );
}
