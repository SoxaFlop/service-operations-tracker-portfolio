import { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const ATTACHMENT_OPTIONS: Array<{ field: string; label: string }> = [
  { field: 'onsiteQuoteLink',         label: 'Onsite Quote' },
  { field: 'technicalQuoteLink',      label: 'Technical Quote' },
  { field: 'salesQuoteLink',          label: 'Sales Quote' },
  { field: 'proformaInvoiceLink',     label: 'Pro Forma Invoice' },
  { field: 'customerPopLink',         label: 'Customer POP' },
  { field: 'onsitePurchaseOrderLink', label: 'Onsite PO' },
  { field: 'onsiteTaxInvoiceLink',    label: 'Onsite Tax Invoice' },
  { field: 'taxInvoiceLink',          label: 'Tax Invoice' },
];

interface Requirement { id?: string; step: string; documents: string; }

interface RequiredAttachmentsPanelProps {
  stepId: string;
  requirements: Requirement[];
  onRequirementsChange: (reqs: Requirement[]) => void;
}

export function RequiredAttachmentsPanel({ stepId, requirements, onRequirementsChange }: RequiredAttachmentsPanelProps) {
  const existing = requirements.find(r => r.step === stepId);
  const [selected, setSelected] = useState<string[]>(
    existing?.documents.split(',').map(d => d.trim()).filter(Boolean) ?? []
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const r = requirements.find(r => r.step === stepId);
    setSelected(r?.documents.split(',').map(d => d.trim()).filter(Boolean) ?? []);
  }, [requirements, stepId]);

  const toggle = (field: string) => {
    setSelected(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]);
  };

  const save = async (next: string[]) => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/settings/step-requirements/${stepId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ documents: next.join(',') }),
      });
      if (!res.ok) { toast.error('Failed to save'); return; }
      const saved: Requirement = await res.json();
      onRequirementsChange(requirements.filter(r => r.step !== stepId).concat(saved));
      toast.success(next.length > 0 ? 'Required attachments updated' : 'Attachment requirements cleared');
    } catch {
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (field: string) => {
    const next = selected.includes(field) ? selected.filter(f => f !== field) : [...selected, field];
    setSelected(next);
    save(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck size={14} className={selected.length > 0 ? 'text-amber-500' : 'text-muted-foreground'} />
        <span className="text-xs font-semibold">
          {selected.length > 0 ? `${selected.length} required attachment${selected.length > 1 ? 's' : ''}` : 'No required attachments'}
        </span>
        <span className="text-[10px] text-muted-foreground">— order cannot advance without these</span>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-2 grid grid-cols-2 gap-0.5">
        {ATTACHMENT_OPTIONS.map(({ field, label }) => (
          <label key={field} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/60 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selected.includes(field)}
              onChange={() => handleToggle(field)}
              disabled={isSaving}
              className="rounded"
            />
            <span className="text-xs truncate">{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
