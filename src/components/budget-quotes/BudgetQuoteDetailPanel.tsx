import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Send, X, Trash2, CheckCircle2, ExternalLink, Paperclip, AlertTriangle } from 'lucide-react';
import { BQ_STATUS_CONFIG, BQ_ATTACHMENT_SLOTS } from '../../constants/budgetQuoteConfig';
import { BudgetQuote } from '../../types';
import { useState } from 'react';
import { format } from 'date-fns';

function StatusBadge({ status }: { status: string }) {
  const cfg = BQ_STATUS_CONFIG[status as keyof typeof BQ_STATUS_CONFIG] ?? { colour: 'bg-slate-100 text-slate-600', label: status };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.colour}`}>
      {cfg.label}
    </span>
  );
}

interface BudgetQuoteDetailPanelProps {
  quote: BudgetQuote;
  isAdmin: boolean;
  isUser: boolean;
  isBdm: boolean;
  isSaving?: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onSubmit: () => Promise<void>;
  onApprove: (notes?: string) => Promise<void>;
  onQuery: (notes: string) => Promise<void>;
  onMarkSent: (subject: string) => Promise<void>;
  onMarkAccepted: () => Promise<void>;
  onMarkDeclined: () => Promise<void>;
  onConvertToOrder: () => Promise<void>;
  setSidebarTab: (tab: string) => void;
  formatCurrency: (n: number) => string;
}

export function BudgetQuoteDetailPanel({
  quote, isAdmin, isUser, isBdm, isSaving = false,
  onBack, onEdit, onDelete,
  onSubmit, onApprove, onQuery, onMarkSent, onMarkAccepted, onMarkDeclined, onConvertToOrder,
  setSidebarTab, formatCurrency,
}: BudgetQuoteDetailPanelProps) {
  const [adminNotes, setAdminNotes] = useState('');
  const [sendSubject, setSendSubject] = useState('');
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showQueryDialog, setShowQueryDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);

  const cfg = BQ_STATUS_CONFIG[quote.status] ?? BQ_STATUS_CONFIG.draft;
  const isExpired = quote.expiresAt && new Date(quote.expiresAt) < new Date() && quote.status !== 'converted';
  const isTerminal = ['converted', 'declined'].includes(quote.status);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="rounded-xl">← Back</Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">
              {quote.clientName}{quote.title ? ` — ${quote.title}` : ''}
            </h1>
            <StatusBadge status={quote.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {quote.quoteNumber} · Updated {format(new Date(quote.updatedAt), 'd MMM yyyy')}
          </p>
        </div>
      </div>

      {/* Admin notes / query */}
      {quote.adminNotes && (
        <Card className={`p-4 ${
          quote.status === 'queried'
            ? 'border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800'
            : 'border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800'
        }`}>
          <p className={`text-xs font-semibold mb-1 ${quote.status === 'queried' ? 'text-orange-700 dark:text-orange-300' : 'text-amber-700 dark:text-amber-300'}`}>
            {quote.status === 'queried' ? 'Query from Admin' : 'Admin Notes'}
          </p>
          <p className="text-sm">{quote.adminNotes}</p>
        </Card>
      )}

      <Card className="p-5 space-y-4">
        {/* Metadata */}
        {quote.creator && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Created By</p>
            <p className="text-sm">{quote.creator.displayName}</p>
          </div>
        )}

        {quote.assignees && quote.assignees.length > 0 && (
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Assignees</p>
            <div className="flex flex-wrap gap-1.5">
              {quote.assignees.map(a => (
                <span key={a.id} className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2.5 py-1 font-medium">
                  {a.displayName}
                  <span className={`text-[9px] px-1 py-0.5 rounded-full font-bold ml-0.5 ${
                    a.role === 'admin'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                      : 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
                  }`}>{a.role}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Client</p>
          <p className="text-sm">{quote.client?.name ?? quote.clientName}</p>
          {quote.client?.contactName && <p className="text-xs text-muted-foreground">{quote.client.contactName}</p>}
          {quote.client?.email && <p className="text-xs text-muted-foreground">{quote.client.email}</p>}
        </div>

        {quote.bdm && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Account Manager</p>
            <p className="text-sm">{quote.bdm.displayName}</p>
          </div>
        )}

        {quote.expiresAt && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Expiry</p>
            <p className={`text-sm flex items-center gap-1 ${isExpired ? 'text-rose-600' : ''}`}>
              {isExpired && <AlertTriangle size={13} />}
              {format(new Date(quote.expiresAt), 'd MMMM yyyy')}
            </p>
          </div>
        )}

        {/* Message */}
        {quote.message && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Message</p>
            <div
              className="text-sm leading-relaxed [&_a]:text-indigo-500 [&_a]:underline [&_img]:inline-block"
              dangerouslySetInnerHTML={{ __html: quote.message }}
            />
          </div>
        )}

        {/* Line items */}
        {quote.products && quote.products.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Line Items</p>
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="divide-y divide-border">
                {quote.products.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="font-medium flex-1">{item.name || '—'}</span>
                    <span className="text-muted-foreground mx-3">
                      {item.category === 'tech_product' ? 'Tech' : item.category === 'sales' ? 'Sales' : item.category === 'training' ? 'Training' : 'Device Management'}
                      {' · '}{item.quantity}×
                    </span>
                    <span className="font-semibold">
                      R {(item.lineTotal || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-3 py-2 bg-muted/10 border-t border-border flex justify-end">
                <span className="text-xs font-bold">
                  Total: {formatCurrency(quote.quoteAmount)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Signature */}
        {quote.signature && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Signature</p>
            <div
              className="text-sm text-foreground [&_a]:text-indigo-500 [&_a]:underline [&_img]:inline-block"
              dangerouslySetInnerHTML={{ __html: quote.signature }}
            />
          </div>
        )}

        {/* Document attachments */}
        {BQ_ATTACHMENT_SLOTS.some(({ field }) => (quote as any)[field]) && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Attachments</p>
            <div className="space-y-1.5">
              {BQ_ATTACHMENT_SLOTS.map(({ field, label }) => {
                const raw = (quote as any)[field] as string | undefined;
                if (!raw) return null;
                const [filename, dataUri] = raw.split('$$$');
                return (
                  <a key={field} href={dataUri} download={filename}
                    className="flex items-center gap-2 text-xs bg-muted rounded-lg px-2.5 py-1.5 hover:bg-muted/80 transition-colors">
                    <Paperclip size={11} className="text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground mr-1 shrink-0">{label}:</span>
                    <span className="font-medium truncate">{filename}</span>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        {quote.notes && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Internal Notes</p>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{quote.notes}</p>
          </div>
        )}

        {/* Converted chip */}
        {quote.status === 'converted' && quote.convertedOrderId && (
          <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl px-4 py-3">
            <CheckCircle2 size={16} className="text-purple-600 shrink-0" />
            <p className="text-sm font-bold text-purple-700 dark:text-purple-300 flex-1">
              Converted to order {quote.convertedOrderId}
            </p>
            <Button
              variant="ghost" size="sm"
              onClick={() => setSidebarTab('dashboard')}
              className="h-7 text-xs gap-1 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg"
            >
              View <ExternalLink size={11} />
            </Button>
          </div>
        )}
      </Card>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {/* Account Manager: draft / queried */}
        {isBdm && ['draft', 'queried'].includes(quote.status) && (
          <>
            <Button variant="outline" onClick={onEdit} className="rounded-xl gap-2">
              {quote.status === 'queried' ? 'Edit & Resubmit' : 'Edit'}
            </Button>
            <Button onClick={() => onSubmit()} className="rounded-xl gap-2 bg-amber-500 hover:bg-amber-600 text-white">
              <Send size={14} /> Submit for Approval
            </Button>
            <Button variant="destructive" onClick={onDelete} className="rounded-xl gap-2">
              <Trash2 size={14} /> Delete
            </Button>
          </>
        )}

        {/* Account Manager: approved — can send */}
        {isBdm && quote.status === 'approved' && (
          <Button
            onClick={() => { setSendSubject(`Budget Quote for ${quote.clientName}`); setShowSendDialog(true); }}
            className="rounded-xl gap-2 bg-indigo-500 hover:bg-indigo-600 text-white"
          >
            <Send size={14} /> Send to Client
          </Button>
        )}

        {/* Account Manager: sent — mark declined */}
        {(isBdm || isAdmin || isUser) && quote.status === 'sent' && (
          <Button
            variant="outline"
            onClick={() => setShowDeclineDialog(true)}
            className="rounded-xl gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
          >
            <X size={14} /> Customer Declined
          </Button>
        )}

        {/* Account Manager/admin/user: accepted — create order */}
        {(isBdm || isAdmin || isUser) && ['approved', 'sent'].includes(quote.status) && (
          <Button variant="outline" onClick={onConvertToOrder} className="rounded-xl gap-2">
            <ExternalLink size={14} /> Create Order from Quote
          </Button>
        )}

        {/* Admin / user: edit (non-sent, non-terminal) */}
        {(isAdmin || isUser) && !['sent'].includes(quote.status) && !isTerminal && (
          <Button variant="outline" onClick={onEdit} className="rounded-xl gap-2">Edit</Button>
        )}

        {/* Admin / user: approve + query (pending) */}
        {(isAdmin || isUser) && quote.status === 'pending_approval' && (
          <>
            <Button
              onClick={() => { setAdminNotes(''); setShowApproveDialog(true); }}
              className="rounded-xl gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 size={14} /> Approve
            </Button>
            <Button
              onClick={() => { setAdminNotes(''); setShowQueryDialog(true); }}
              className="rounded-xl gap-2 bg-amber-500 hover:bg-amber-600 text-white"
            >
              <X size={14} /> Query Quote
            </Button>
          </>
        )}

        {/* Admin / user: send to client (draft or approved) */}
        {(isAdmin || isUser) && ['draft', 'approved'].includes(quote.status) && (
          <Button
            onClick={() => { setSendSubject(`Budget Quote for ${quote.clientName}`); setShowSendDialog(true); }}
            className="rounded-xl gap-2 bg-indigo-500 hover:bg-indigo-600 text-white"
          >
            <Send size={14} /> Send to Client
          </Button>
        )}

        {/* Admin / user: accepted — convert to order */}
        {(isAdmin || isUser) && quote.status === 'accepted' && (
          <Button
            onClick={onConvertToOrder}
            className="rounded-xl gap-2 bg-purple-500 hover:bg-purple-600 text-white"
          >
            <ExternalLink size={14} /> Convert to Order
          </Button>
        )}

        {/* Admin / user: delete */}
        {(isAdmin || isUser) && (
          <Button
            variant="ghost"
            onClick={onDelete}
            className="rounded-xl text-destructive hover:text-destructive gap-2 ml-auto"
          >
            <Trash2 size={14} /> Delete
          </Button>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Approve Budget Quote</DialogTitle>
            <DialogDescription>Optionally add a note before approving.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Any comments for the creator…"
              rows={3}
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              className="resize-none rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={async () => { setShowApproveDialog(false); await onApprove(adminNotes); }}
              disabled={isSaving}
              className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
            >
              {isSaving ? 'Approving…' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Query Dialog */}
      <Dialog open={showQueryDialog} onOpenChange={setShowQueryDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Query Budget Quote</DialogTitle>
            <DialogDescription>Add notes explaining what needs clarification.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Query notes <span className="text-rose-500">*</span></Label>
            <Textarea
              placeholder="Explain what needs to be clarified or changed…"
              rows={3}
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              className="resize-none rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQueryDialog(false)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={async () => { setShowQueryDialog(false); await onQuery(adminNotes); }}
              disabled={isSaving || !adminNotes.trim()}
              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isSaving ? 'Sending…' : 'Send Query'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Declined Dialog */}
      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Customer Declined</DialogTitle>
            <DialogDescription>
              Mark this budget quote as declined by the customer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeclineDialog(false)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={async () => { setShowDeclineDialog(false); await onMarkDeclined(); }}
              disabled={isSaving}
              className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isSaving ? 'Saving…' : 'Mark as Declined'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Send Budget Quote to Client</DialogTitle>
            <DialogDescription>
              This will email <strong>{quote.client?.email}</strong> with the budget quote details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Email Subject</Label>
            <Input value={sendSubject} onChange={e => setSendSubject(e.target.value)} className="rounded-xl" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={async () => { setShowSendDialog(false); await onMarkSent(sendSubject); }}
              disabled={isSaving || !sendSubject.trim()}
              className="rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white gap-2"
            >
              <Send size={14} /> {isSaving ? 'Sending…' : 'Send to Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
