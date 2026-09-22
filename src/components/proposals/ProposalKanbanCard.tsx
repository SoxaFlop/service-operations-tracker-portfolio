import { AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Proposal } from '../../types';
import { STATUS_CONFIG } from '../../constants/proposalConfig';

interface ProposalKanbanCardProps {
  p: Proposal;
  isAdmin: boolean;
  onClick: () => void;
}

export function ProposalKanbanCard({ p, isAdmin, onClick }: ProposalKanbanCardProps) {
  const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.draft;
  const total = (p.products ?? []).reduce((s, item) => s + (item.lineTotal || 0), 0);
  const isExpired = !!(p.expiresAt && new Date(p.expiresAt) < new Date() && p.status !== 'sent');

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border/60 rounded-2xl p-4 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all space-y-3 relative overflow-hidden"
    >
      <div className={`absolute top-0 left-0 w-1 h-full ${cfg.dot} rounded-l-2xl`} />

      <div className="flex items-start justify-between gap-2 pl-1">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate leading-tight">{p.title}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{p.client?.name ?? p.clientId}</p>
          {isAdmin && p.bdm && (
            <p className="text-[10px] text-muted-foreground/60 truncate">by {p.bdm.displayName}</p>
          )}
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>

      <div className="flex items-center justify-between pl-1">
        {total > 0 ? (
          <span className="text-sm font-bold text-foreground">
            R {total.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        ) : <span />}
        <div className="flex items-center gap-2">
          {isExpired && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600">
              <AlertCircle size={10} /> Expired
            </span>
          )}
          {p.expiresAt && !isExpired && (
            <span className="text-[10px] text-muted-foreground/60">
              Exp {format(new Date(p.expiresAt), 'd MMM yy')}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(p.updatedAt), 'd MMM yy')}
          </span>
        </div>
      </div>

      {p.assignees && p.assignees.length > 0 && (
        <div className="flex gap-1 flex-wrap pl-1">
          {p.assignees.slice(0, 3).map(a => (
            <span key={a.id} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full font-medium text-muted-foreground">
              {a.displayName}
            </span>
          ))}
          {p.assignees.length > 3 && (
            <span className="text-[9px] text-muted-foreground">+{p.assignees.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}
