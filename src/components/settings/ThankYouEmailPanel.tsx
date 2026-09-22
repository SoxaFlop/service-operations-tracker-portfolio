import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Check, Mail } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_SUBJECT = 'Thank you for your order — {clientName}';
const DEFAULT_BODY = `Hi {contactName},

Thank you for your order — we truly appreciate your trust in Example Company.

Your order ({orderId}) has been received and is currently being processed. We will keep you updated as things progress.

If you have any questions or need assistance at any stage, please don't hesitate to reply to this email — our team is always here to help.

We look forward to supporting you.

Warm regards,
The Example Company Team`;

const TEMPLATE_VARIABLES = [
  ['{orderId}',      'Order ID, e.g. DEMO-6165'],
  ['{clientName}',   'Company name on the order'],
  ['{contactName}',  'Contact person from client record'],
  ['{orderDate}',    'Date the order was created'],
] as const;

interface ThankYouConfig {
  id?: string;
  step: string;
  enabled: boolean;
  subject?: string | null;
  emailBody?: string | null;
}

interface ThankYouEmailPanelProps {
  stepId: string;
  configs: ThankYouConfig[];
  onConfigsChange: (configs: ThankYouConfig[]) => void;
}

export function ThankYouEmailPanel({ stepId, configs, onConfigsChange }: ThankYouEmailPanelProps) {
  const existing = configs.find(c => c.step === stepId);
  const [enabled, setEnabled] = useState(existing?.enabled ?? false);
  const [subject, setSubject] = useState(existing?.subject ?? '');
  const [body, setBody] = useState(existing?.emailBody ?? '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const c = configs.find(c => c.step === stepId);
    setEnabled(c?.enabled ?? false);
    setSubject(c?.subject ?? '');
    setBody(c?.emailBody ?? '');
  }, [configs, stepId]);

  const save = async (nextEnabled: boolean, nextSubject: string, nextBody: string) => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/settings/thank-you-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          step: stepId,
          enabled: nextEnabled,
          subject: nextSubject.trim() || null,
          emailBody: nextBody.trim() || null,
        }),
      });
      if (!res.ok) { toast.error('Failed to save'); return; }
      const saved: ThankYouConfig = await res.json();
      const next = configs.filter(c => c.step !== stepId).concat(saved);
      onConfigsChange(next);
      toast.success(nextEnabled ? 'Thank-you email enabled' : 'Thank-you email disabled');
    } catch {
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    save(next, subject, body);
  };

  return (
    <div className="space-y-3">
      {/* Toggle row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail size={14} className={enabled ? 'text-teal-500' : 'text-muted-foreground'} />
          <span className="text-xs font-semibold">
            {enabled ? 'Thank-you email enabled' : 'Thank-you email disabled'}
          </span>
          <span className="text-[10px] text-muted-foreground">— sent to client when order leaves this step</span>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={isSaving}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
            enabled ? 'bg-teal-500' : 'bg-muted-foreground/30'
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-4' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {/* Editable fields — shown when enabled */}
      {enabled && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subject</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder={DEFAULT_SUBJECT}
              className="rounded-xl text-xs h-8"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email Body</Label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={DEFAULT_BODY}
              rows={8}
              className="rounded-xl text-xs resize-none font-mono"
            />
          </div>

          {/* Template variable hints */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Template Variables</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_VARIABLES.map(([v, hint]) => (
                <span
                  key={v}
                  title={hint}
                  className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded cursor-default"
                >
                  {v}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">Leave subject/body blank to use the default warm template.</p>
          </div>

          <Button
            size="sm"
            onClick={() => save(enabled, subject, body)}
            disabled={isSaving}
            className="rounded-xl h-7 text-xs gap-1.5"
          >
            <Check size={12} /> {isSaving ? 'Saving…' : 'Save Email'}
          </Button>
        </div>
      )}
    </div>
  );
}
