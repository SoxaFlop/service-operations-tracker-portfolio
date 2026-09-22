import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Plus, Check, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile } from '../../types';

const DOC_OPTIONS: { field: string; label: string }[] = [
  { field: 'onsiteQuoteLink',         label: 'Onsite Quote' },
  { field: 'technicalQuoteLink',      label: 'Technical Quote' },
  { field: 'salesQuoteLink',          label: 'Sales Quote' },
  { field: 'proformaInvoiceLink',     label: 'Pro Forma Invoice' },
  { field: 'customerPopLink',         label: 'Customer POP' },
  { field: 'onsitePurchaseOrderLink', label: 'Onsite PO' },
  { field: 'onsiteTaxInvoiceLink',    label: 'Onsite Tax Invoice' },
  { field: 'taxInvoiceLink',          label: 'Tax Invoice' },
];

const TEMPLATE_VARIABLES = [
  ['{orderId}',             'Order ID, e.g. DEMO-6165'],
  ['{clientName}',          'Company name on the order'],
  ['{contactName}',         "Contact person from client record"],
  ['{clientEmail}',         "Client's email address"],
  ['{quoteAmount}',         'Formatted total, e.g. R 10 000,00'],
  ['{productList}',         'Line-by-line list of products & quantities'],
  ['{supplierQuoteNumber}', 'Supplier quote / reference number'],
  ['{assignedTo}',          'team member assigned to the order'],
  ['{orderDate}',           'Date the order was created'],
  ['{orderNotes}',          'Internal notes on the order'],
  ['{stepLabel}',           'Workflow step the order is leaving'],
] as const;

function docLabel(fields: string) {
  return fields
    .split(',')
    .map(f => DOC_OPTIONS.find(o => o.field === f.trim())?.label ?? f.trim())
    .join(', ');
}

interface DocumentTriggerPanelProps {
  stepId: string;
  users: UserProfile[];
  triggers: any[];
  onTriggersChange: (triggers: any[]) => void;
}

export function DocumentTriggerPanel({ stepId, users: _users, triggers, onTriggersChange }: DocumentTriggerPanelProps) {
  const stepTriggers = triggers.filter(t => t.step === stepId);

  const [isAdding, setIsAdding] = useState(false);
  const [newDocs, setNewDocs] = useState<string[]>(['taxInvoiceLink']);
  const [newRecipient, setNewRecipient] = useState<'client' | 'custom'>('client');
  const [newEmail, setNewEmail] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newClearAfter, setNewClearAfter] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);

  const token = () => localStorage.getItem('token');

  const resetAddForm = () => {
    setNewDocs(['taxInvoiceLink']);
    setNewRecipient('client');
    setNewEmail('');
    setNewSubject('');
    setNewBody('');
    setNewClearAfter(false);
    setIsAdding(false);
  };

  const handleAdd = async () => {
    if (newDocs.length === 0) { toast.error('Select at least one document'); return; }
    if (newRecipient === 'custom' && !newEmail.trim()) { toast.error('Please enter a recipient email'); return; }
    try {
      const res = await fetch('/api/settings/document-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({
          step: stepId,
          document: newDocs.join(','),
          recipientType: newRecipient,
          customEmail: newRecipient === 'custom' ? newEmail.trim() : null,
          subject: newSubject.trim() || null,
          emailBody: newBody.trim() || null,
          clearAllAttachmentsAfter: newClearAfter,
        }),
      });
      const created = await res.json();
      onTriggersChange([...triggers, created]);
      resetAddForm();
    } catch {
      toast.error('Failed to create trigger');
    }
  };

  const handleToggle = async (trigger: any) => {
    try {
      await fetch(`/api/settings/document-triggers/${trigger.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ ...trigger, enabled: !trigger.enabled }),
      });
      onTriggersChange(triggers.map(t => t.id === trigger.id ? { ...t, enabled: !t.enabled } : t));
    } catch {
      toast.error('Failed to update trigger');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/settings/document-triggers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      onTriggersChange(triggers.filter(t => t.id !== id));
    } catch {
      toast.error('Failed to delete trigger');
    }
  };

  const handleSaveEdit = async () => {
    if (!editData) return;
    if (editData.recipientType === 'custom' && !editData.customEmail?.trim()) {
      toast.error('Please enter a recipient email');
      return;
    }
    try {
      const res = await fetch(`/api/settings/document-triggers/${editData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({
          document: editData.document,
          recipientType: editData.recipientType,
          customEmail: editData.recipientType === 'custom' ? editData.customEmail : null,
          subject: editData.subject || null,
          emailBody: editData.emailBody || null,
          enabled: editData.enabled,
          clearAllAttachmentsAfter: !!editData.clearAllAttachmentsAfter,
        }),
      });
      const updated = await res.json();
      onTriggersChange(triggers.map(t => t.id === updated.id ? updated : t));
      setEditingId(null);
      setEditData(null);
    } catch {
      toast.error('Failed to save trigger');
    }
  };

  const DocCheckboxGrid = ({
    selected,
    onChange,
  }: {
    selected: string[];
    onChange: (field: string) => void;
  }) => (
    <div className="grid grid-cols-2 gap-1">
      {DOC_OPTIONS.map(opt => (
        <label key={opt.field} className="flex items-center gap-1.5 cursor-pointer select-none text-xs">
          <input
            type="checkbox"
            checked={selected.includes(opt.field)}
            onChange={() => onChange(opt.field)}
            className="rounded"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );

  return (
    <div className="bg-muted/20 p-3 rounded-xl border border-border/30 ml-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Send size={12} className="text-muted-foreground" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Send Document On Leave</span>
        </div>
        {!isAdding && (
          <button
            onClick={() => { resetAddForm(); setIsAdding(true); }}
            className="text-[9px] font-bold px-2 py-1 rounded-lg border bg-muted text-muted-foreground border-border hover:bg-primary/10 hover:text-primary transition-all flex items-center gap-1"
          >
            <Plus size={10} /> Add
          </button>
        )}
      </div>

      <div className="grid gap-2">
        {stepTriggers.map(trigger => (
          <div key={trigger.id} className="rounded-xl border border-border/50 bg-background/50 overflow-hidden">
            {editingId === trigger.id ? (
              <div className="p-3 space-y-2">
                <div className="grid gap-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Documents to attach</span>
                  <DocCheckboxGrid
                    selected={editData?.document?.split(',').map((d: string) => d.trim()).filter(Boolean) ?? []}
                    onChange={field => {
                      const cur: string[] = editData?.document?.split(',').map((d: string) => d.trim()).filter(Boolean) ?? [];
                      const checked = cur.includes(field);
                      setEditData((p: any) => ({ ...p, document: (checked ? cur.filter(f => f !== field) : [...cur, field]).join(',') }));
                    }}
                  />
                </div>
                <div className="grid gap-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Send To</span>
                  <select
                    value={editData?.recipientType}
                    onChange={e => setEditData((p: any) => ({ ...p, recipientType: e.target.value }))}
                    className="h-7 text-xs rounded-lg border border-border bg-background px-2 font-medium"
                  >
                    <option value="client">Client email (from order)</option>
                    <option value="custom">Custom email</option>
                  </select>
                </div>
                {editData?.recipientType === 'custom' && (
                  <Input
                    placeholder="email@example.com"
                    value={editData?.customEmail || ''}
                    onChange={e => setEditData((p: any) => ({ ...p, customEmail: e.target.value }))}
                    className="h-7 text-xs rounded-lg"
                  />
                )}
                <Input
                  placeholder="Email subject (optional)"
                  value={editData?.subject || ''}
                  onChange={e => setEditData((p: any) => ({ ...p, subject: e.target.value }))}
                  className="h-7 text-xs rounded-lg"
                />
                <div className="grid gap-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    Email Body <span className="font-normal normal-case opacity-60">(optional — leave blank for default)</span>
                  </span>
                  <textarea
                    placeholder="Good day {contactName},\n\nPlease find attached a document for {clientName}.\n\nKind regards,\nService Operations Team"
                    value={editData?.emailBody || ''}
                    onChange={e => setEditData((p: any) => ({ ...p, emailBody: e.target.value }))}
                    rows={5}
                    className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-2 space-y-1">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Available Variables</p>
                    {TEMPLATE_VARIABLES.map(([v, desc]) => (
                      <div key={v} className="flex items-baseline gap-2">
                        <code className="font-mono text-[9px] text-primary shrink-0">{v}</code>
                        <span className="text-[9px] text-muted-foreground/70">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editData?.clearAllAttachmentsAfter}
                    onChange={e => setEditData((p: any) => ({ ...p, clearAllAttachmentsAfter: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Clear all attachments after sending</span>
                </label>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleSaveEdit} className="rounded-lg h-7 px-3 text-xs gap-1">
                    <Check size={11} /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditData(null); }} className="rounded-lg h-7 px-3 text-xs">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2 gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-foreground">{docLabel(trigger.document)}</p>
                  <p className="text-[9px] text-muted-foreground truncate">
                    {trigger.recipientType === 'client' ? 'Client email' : trigger.customEmail}
                    {trigger.subject ? ` · "${trigger.subject}"` : ''}
                    {trigger.clearAllAttachmentsAfter ? ' · Clears attachments' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(trigger)}
                    className={`text-[9px] font-bold px-2 py-1 rounded-lg border transition-all ${
                      trigger.enabled ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {trigger.enabled ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => { setEditingId(trigger.id); setEditData({ ...trigger }); }}
                    className="h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() => handleDelete(trigger.id)}
                    className="h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-50 transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="mt-2 space-y-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
          <div className="grid gap-1">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Documents to attach</span>
            <DocCheckboxGrid
              selected={newDocs}
              onChange={field => setNewDocs(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field])}
            />
          </div>
          <div className="grid gap-1">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Send To</span>
            <select
              value={newRecipient}
              onChange={e => setNewRecipient(e.target.value as 'client' | 'custom')}
              className="h-7 text-xs rounded-lg border border-border bg-background px-2 font-medium"
            >
              <option value="client">Client email (from order)</option>
              <option value="custom">Custom email</option>
            </select>
          </div>
          {newRecipient === 'custom' && (
            <Input placeholder="email@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="h-7 text-xs rounded-lg" />
          )}
          <Input placeholder="Email subject (optional)" value={newSubject} onChange={e => setNewSubject(e.target.value)} className="h-7 text-xs rounded-lg" />
          <div className="grid gap-1">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
              Email Body <span className="font-normal normal-case opacity-60">(optional — leave blank for default)</span>
            </span>
            <textarea
              placeholder="Good day {contactName},..."
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              rows={5}
              className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <p className="text-[9px] text-muted-foreground/60 leading-tight">
              Variables: <code className="font-mono">{'{orderId}'}</code>, <code className="font-mono">{'{contactName}'}</code>, <code className="font-mono">{'{clientName}'}</code>, <code className="font-mono">{'{orderNotes}'}</code>, <code className="font-mono">{'{stepLabel}'}</code>
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={newClearAfter} onChange={e => setNewClearAfter(e.target.checked)} className="rounded" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Clear all attachments after sending</span>
          </label>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleAdd} className="rounded-lg h-7 px-3 text-xs gap-1">
              <Check size={11} /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={resetAddForm} className="rounded-lg h-7 px-3 text-xs">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {stepTriggers.length === 0 && !isAdding && (
        <p className="text-[10px] text-muted-foreground/50 italic text-center py-1">No document triggers</p>
      )}
    </div>
  );
}
