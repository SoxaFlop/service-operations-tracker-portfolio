import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Send, X, Trash2, CheckCircle2, ExternalLink, Paperclip } from 'lucide-react';
import { STATUS_CONFIG, PROPOSAL_DOC_FIELDS } from '../../constants/proposalConfig';
import { Proposal } from '../../types';
import { format } from 'date-fns';

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, colour: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.colour}`}>
      {cfg.label}
    </span>
  );
}


interface ProposalDetailViewProps {
  proposal: Proposal;
  isAdmin: boolean;
  isBdm: boolean;
  isUser?: boolean;
  isSaving: boolean;
  adminNotes: string;
  setAdminNotes: (v: string) => void;
  sendSubject: string;
  setSendSubject: (v: string) => void;
  showApproveDialog: boolean;
  setShowApproveDialog: (v: boolean) => void;
  showQueryDialog: boolean;
  setShowQueryDialog: (v: boolean) => void;
  showSendDialog: boolean;
  setShowSendDialog: (v: boolean) => void;
  showDeclineDialog: boolean;
  setShowDeclineDialog: (v: boolean) => void;
  onBack: () => void;
  onEdit: (p: Proposal) => void;
  onDelete: (p: Proposal) => void;
  onSubmit: (p: Proposal) => void;
  onApprove: () => void;
  onQuery: () => void;
  onSend: () => void;
  onDecline: () => void;
  onCreateOrder: (p: Proposal) => void;
}

export function ProposalDetailView({
  proposal: p,
  isAdmin, isBdm, isUser = false, isSaving,
  adminNotes, setAdminNotes,
  sendSubject, setSendSubject,
  showApproveDialog, setShowApproveDialog,
  showQueryDialog, setShowQueryDialog,
  showSendDialog, setShowSendDialog,
  showDeclineDialog, setShowDeclineDialog,
  onBack, onEdit, onDelete, onSubmit, onApprove, onQuery, onSend, onDecline, onCreateOrder,
}: ProposalDetailViewProps) {
  const namedDocs = PROPOSAL_DOC_FIELDS.filter(({ field }) => !!(p as any)[field]);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="rounded-xl">← Back</Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{p.title}</h1>
            <StatusBadge status={p.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {p.client?.name} — Updated {format(new Date(p.updatedAt), 'd MMM yyyy')}
          </p>
        </div>
      </div>

      {p.adminNotes && (
        <Card className="p-4 border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Admin Notes</p>
          <p className="text-sm">{p.adminNotes}</p>
        </Card>
      )}

      <Card className="p-5 space-y-4">
        {isAdmin && p.bdm && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Created By</p>
            <p className="text-sm">{p.bdm.displayName} <span className="text-muted-foreground">({p.bdm.email})</span></p>
          </div>
        )}

        {p.assignees && p.assignees.length > 0 && (
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Assignees</p>
            <div className="flex flex-wrap gap-1.5">
              {p.assignees.map(a => (
                <span key={a.id} className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2.5 py-1 font-medium">
                  {a.displayName}
                  <span className={`text-[9px] px-1 py-0.5 rounded-full font-bold ml-0.5 ${
                    a.role === 'admin'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                      : 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
                  }`}>
                    {a.role}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Client</p>
          <p className="text-sm">{p.client?.name}</p>
          <p className="text-xs text-muted-foreground">{p.client?.email}</p>
        </div>

        {p.expiresAt && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Expiry</p>
            <p className="text-sm">{format(new Date(p.expiresAt), 'd MMMM yyyy')}</p>
          </div>
        )}

        {p.message && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Message</p>
            <div
              className="text-sm leading-relaxed [&_a]:text-indigo-500 [&_a]:underline [&_img]:inline-block"
              dangerouslySetInnerHTML={{ __html: p.message }}
            />
          </div>
        )}

        {(p.products ?? []).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Line Items</p>
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="divide-y divide-border">
                {(p.products ?? []).map((item, i) => (
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
                  Total: R {(p.products ?? []).reduce((s, item) => s + (item.lineTotal || 0), 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}

        {p.signature && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Signature</p>
            <div
              className="text-sm text-foreground [&_a]:text-indigo-500 [&_a]:underline [&_img]:inline-block"
              dangerouslySetInnerHTML={{ __html: p.signature }}
            />
          </div>
        )}

        {namedDocs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Attachments</p>
            <div className="space-y-1">
              {namedDocs.map(({ field, label }) => {
                const raw = (p as any)[field] as string;
                const filename = raw.split('$$$')[0];
                const dataUri = raw.split('$$$')[1];
                return (
                  <a key={field} href={dataUri} download={filename}
                    className="flex items-center gap-2 text-xs bg-muted rounded-lg px-2.5 py-1.5 hover:bg-muted/80 transition-colors">
                    <Paperclip size={11} className="text-muted-foreground shrink-0" />
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground truncate flex-1">{filename}</span>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {isBdm && p.status === 'draft' && (
          <>
            <Button variant="outline" onClick={() => onEdit(p)} className="rounded-xl gap-2">Edit</Button>
            <Button onClick={() => onSubmit(p)} className="rounded-xl gap-2 bg-amber-500 hover:bg-amber-600 text-white">
              <Send size={14} /> Submit for Approval
            </Button>
            <Button variant="destructive" onClick={() => onDelete(p)} className="rounded-xl gap-2">
              <Trash2 size={14} /> Delete
            </Button>
          </>
        )}
        {isBdm && ['queried', 'rejected'].includes(p.status) && (
          <>
            <Button variant="outline" onClick={() => onEdit(p)} className="rounded-xl gap-2">Edit & Resubmit</Button>
            <Button variant="destructive" onClick={() => onDelete(p)} className="rounded-xl gap-2">
              <Trash2 size={14} /> Delete
            </Button>
          </>
        )}
        {isBdm && p.status === 'approved' && (
          <Button
            onClick={() => { setSendSubject(`Proposal from Example Company — ${p.title}`); setShowSendDialog(true); }}
            className="rounded-xl gap-2 bg-indigo-500 hover:bg-indigo-600 text-white"
          >
            <Send size={14} /> Send to Client
          </Button>
        )}
        {(isBdm || isAdmin) && p.status === 'sent' && (
          <Button
            variant="outline"
            onClick={() => setShowDeclineDialog(true)}
            className="rounded-xl gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
          >
            <X size={14} /> Customer Declined
          </Button>
        )}
        {(isBdm || isAdmin || isUser) && ['approved', 'sent'].includes(p.status) && (
          <Button variant="outline" onClick={() => onCreateOrder(p)} className="rounded-xl gap-2">
            <ExternalLink size={14} /> Create Order from Proposal
          </Button>
        )}

        {(isAdmin || isUser) && !['sent'].includes(p.status) && (
          <Button variant="outline" onClick={() => onEdit(p)} className="rounded-xl gap-2">Edit</Button>
        )}
        {(isAdmin || isUser) && p.status === 'pending_approval' && (
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
              <X size={14} /> Query Proposal
            </Button>
          </>
        )}
        {(isAdmin || isUser) && ['approved', 'draft'].includes(p.status) && (
          <Button
            onClick={() => { setSendSubject(`Proposal from Example Company — ${p.title}`); setShowSendDialog(true); }}
            className="rounded-xl gap-2 bg-indigo-500 hover:bg-indigo-600 text-white"
          >
            <Send size={14} /> Send to Client
          </Button>
        )}
        {(isAdmin || isUser) && (
          <Button
            variant="ghost"
            onClick={() => onDelete(p)}
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
            <DialogTitle>Approve Proposal</DialogTitle>
            <DialogDescription>Optionally add a note for the Account Manager before approving.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Any comments for the Account Manager…"
              rows={3}
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              className="resize-none rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={onApprove} disabled={isSaving} className="rounded-xl bg-green-600 hover:bg-green-700 text-white">
              {isSaving ? 'Approving…' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Query Dialog */}
      <Dialog open={showQueryDialog} onOpenChange={setShowQueryDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Query Proposal</DialogTitle>
            <DialogDescription>Add notes for the Account Manager explaining what needs clarification.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Query notes</Label>
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
            <Button onClick={onQuery} disabled={isSaving} className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white">
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
              Mark this proposal as declined by the customer. The proposal will be moved to the Declined column.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeclineDialog(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={onDecline} disabled={isSaving} className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white">
              {isSaving ? 'Saving…' : 'Mark as Declined'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Send Proposal to Client</DialogTitle>
            <DialogDescription>
              This will email <strong>{p.client?.email}</strong> with all attachments.
              {isBdm ? " All admins will be CC'd." : ` The Account Manager (${p.bdm?.email}) and all admins will be CC'd.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Email Subject</Label>
            <Input value={sendSubject} onChange={e => setSendSubject(e.target.value)} className="rounded-xl" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={onSend} disabled={isSaving} className="rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white gap-2">
              <Send size={14} /> {isSaving ? 'Sending…' : 'Send to Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
