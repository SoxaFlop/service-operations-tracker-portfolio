import { BudgetQuote } from '../../types';
import { BQ_STATUS_CONFIG } from '../../constants/budgetQuoteConfig';
import { AlertTriangle } from 'lucide-react';

interface BudgetQuoteCardProps {
  quote: BudgetQuote;
  onClick: () => void;
  formatCurrency: (n: number) => string;
}

export function BudgetQuoteCard({ quote, onClick, formatCurrency }: BudgetQuoteCardProps) {
  const cfg = BQ_STATUS_CONFIG[quote.status] ?? BQ_STATUS_CONFIG.draft;
  const isExpired = quote.expiresAt && new Date(quote.expiresAt) < new Date() && quote.status !== 'converted';

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border/60 rounded-2xl p-4 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all space-y-3 relative overflow-hidden"
    >
      <div className={`absolute top-0 left-0 w-1 h-full ${cfg.dot} rounded-l-2xl`} />

      <div className="flex items-start justify-between gap-2 pl-1">
        <div className="min-w-0">
          <p className="text-[9px] font-black text-muted-foreground/50 tracking-[0.18em] uppercase font-mono">
            {quote.quoteNumber}
          </p>
          <p className="text-sm font-bold text-foreground truncate leading-tight mt-0.5">
            {quote.clientName}
          </p>
          {quote.title && (
            <p className="text-xs text-muted-foreground truncate">{quote.title}</p>
          )}
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>

      <div className="flex items-center justify-between pl-1">
        <span className="text-sm font-bold text-foreground">
          {formatCurrency(quote.quoteAmount)}
        </span>
        <div className="flex items-center gap-2">
          {isExpired && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600">
              <AlertTriangle size={10} /> Expired
            </span>
          )}
          {quote.bdm && (
            <span className="text-[10px] text-muted-foreground">
              {quote.bdm.displayName.split(' ')[0]}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {new Date(quote.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>

      {quote.convertedOrderId && (
        <p className="pl-1 text-[10px] font-bold text-purple-600 dark:text-purple-400">
          → {quote.convertedOrderId}
        </p>
      )}
    </div>
  );
}
