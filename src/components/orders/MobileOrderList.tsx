import { useState } from 'react';
import { ArrowRight, Loader2, ChevronDown, ChevronUp, Lock } from 'lucide-react';

const DOC_LABELS: Record<string, string> = {
  onsiteQuoteLink: 'Onsite Quote', technicalQuoteLink: 'Technical Quote',
  salesQuoteLink: 'Sales Quote', proformaInvoiceLink: 'Pro Forma Invoice',
  customerPopLink: 'Customer POP', onsitePurchaseOrderLink: 'Onsite PO',
  onsiteTaxInvoiceLink: 'Onsite Tax Invoice', taxInvoiceLink: 'Tax Invoice',
  customerQuoteLink: 'Customer Quote',
};
import { Badge } from '@/components/ui/badge';
import { Order, OrderStatus } from '../../types';
import { WorkflowStep } from '../../hooks/useSteps';
import { calculateBusinessDays } from '@/lib/utils';

interface MobileOrderListProps {
  activeOrders: Order[];
  steps: WorkflowStep[];
  setSelectedOrder: (order: Order) => Promise<void>;
  moveOrder: (firestoreId: string, newStatus: OrderStatus) => Promise<void>;
  formatCurrency: (amount?: number) => string;
  isViewer?: boolean;
  canAdvanceStep: (stepId: string) => boolean;
}

function urgencyColor(days: number, isExternal: boolean): string {
  if (isExternal) return 'text-sky-500';
  if (days < 1) return 'text-emerald-500';
  if (days < 2) return 'text-lime-600';
  if (days < 3) return 'text-yellow-600';
  if (days < 4) return 'text-orange-500';
  return 'text-rose-600';
}

function urgencyBg(days: number, isExternal: boolean): string {
  if (isExternal) return 'bg-sky-50/80 dark:bg-sky-900/20 border-sky-200';
  if (days < 2) return 'bg-card border-border/50';
  if (days < 3) return 'bg-yellow-50/40 dark:bg-yellow-900/10 border-yellow-200/60';
  if (days < 4) return 'bg-orange-50/40 dark:bg-orange-900/10 border-orange-200/60';
  return 'bg-rose-50/40 dark:bg-rose-900/10 border-rose-300/60';
}

function MobileOrderRow({
  order,
  step,
  steps,
  onOpen,
  onMove,
  formatCurrency,
  isViewer,
  canAdvanceStep,
}: {
  order: Order;
  step: WorkflowStep;
  steps: WorkflowStep[];
  onOpen: () => void;
  onMove: (id: string, status: OrderStatus) => Promise<void>;
  formatCurrency: (n?: number) => string;
  isViewer?: boolean;
  canAdvanceStep: (stepId: string) => boolean;
}) {
  const [isMoving, setIsMoving] = useState(false);

  const currentIdx = steps.findIndex(s => s.id === order.status);
  const nextStep = currentIdx < steps.length - 1 ? steps[currentIdx + 1] : undefined;
  const isLastActive = nextStep?.id === steps[steps.length - 1].id;

  const currentAudit = (order.audits || []).find(a => a.step === order.status && !a.completedAt);
  const days = currentAudit
    ? calculateBusinessDays(new Date(currentAudit.startedAt), new Date())
    : calculateBusinessDays(new Date(order.updatedAt), new Date());

  const daysDisplay = days < 1 ? '<1d' : `${Math.floor(days)}d`;
  const value = formatCurrency(order.quoteAmount || (order.products || []).reduce((s, p) => s + (p.lineTotal || 0), 0));
  const canAdvance = !isViewer && nextStep && canAdvanceStep(order.status);

  const handleAdvance = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.firestoreId || isMoving || !nextStep) return;
    setIsMoving(true);
    try {
      await onMove(order.firestoreId, nextStep.id as OrderStatus);
    } finally {
      setIsMoving(false);
    }
  };

  const colorDot = step.color.split(' ')[0];

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.99] ${urgencyBg(days, step.isExternalTeam)} relative overflow-hidden`}
      onClick={onOpen}
    >
      <div className={`absolute left-0 top-0 w-1 h-full ${colorDot} rounded-l-2xl`} />

      <div className="flex-1 min-w-0 pl-1">
        <p className="text-sm font-bold text-foreground truncate leading-tight">{order.clientName}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className={`text-[10px] font-black ${urgencyColor(days, step.isExternalTeam)}`}>{daysDisplay}</span>
          <span className="text-muted-foreground/30 text-[10px]">·</span>
          <span className="text-[10px] font-bold text-muted-foreground">{value}</span>
          {step.isExternalTeam && (
            <Badge variant="outline" className="text-[8px] font-bold border-sky-200 text-sky-600 rounded-full px-1 h-3.5">Ext</Badge>
          )}
          {(order.category === 'tech_product' || (order.products?.[0]?.category === 'tech_product')) && (
            <Badge variant="outline" className="text-[8px] font-bold border-purple-200 text-purple-600 rounded-full px-1 h-3.5">Tech</Badge>
          )}
        </div>
      </div>

      {canAdvance && (
        order.advanceBlocked ? (
          <div
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 cursor-not-allowed"
            title={`Missing: ${order.missingRequiredDocs?.map(d => DOC_LABELS[d] ?? d).join(', ')}`}
          >
            <Lock size={13} className="text-amber-600" />
          </div>
        ) : (
          <button
            onClick={handleAdvance}
            className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              isLastActive
                ? 'bg-emerald-500 text-white'
                : 'bg-primary/10 text-primary'
            }`}
          >
            {isMoving ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
          </button>
        )
      )}
    </div>
  );
}

export function MobileOrderList({
  activeOrders,
  steps,
  setSelectedOrder,
  moveOrder,
  formatCurrency,
  isViewer,
  canAdvanceStep,
}: MobileOrderListProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const activeSteps = steps.slice(0, -1);
  const totalOrders = activeOrders.length;

  if (totalOrders === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
          <ArrowRight size={24} className="text-muted-foreground/30" />
        </div>
        <p className="text-sm font-bold text-muted-foreground">No active orders</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {activeSteps.map(step => {
        const stepOrders = activeOrders.filter(o => o.status === step.id);
        if (stepOrders.length === 0) return null;
        const isCollapsed = collapsed[step.id];
        const colorDot = step.color.split(' ')[0];

        return (
          <section key={step.id}>
            <button
              className="flex items-center gap-2 w-full mb-2 px-1"
              onClick={() => setCollapsed(prev => ({ ...prev, [step.id]: !prev[step.id] }))}
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${colorDot}`} />
              <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest flex-1 text-left">{step.label}</span>
              <Badge variant="outline" className="text-[9px] font-bold rounded-full px-1.5 h-4 border-border">
                {stepOrders.length}
              </Badge>
              {isCollapsed ? <ChevronDown size={13} className="text-muted-foreground/50" /> : <ChevronUp size={13} className="text-muted-foreground/50" />}
            </button>

            {!isCollapsed && (
              <div className="space-y-2">
                {stepOrders.map(order => (
                  <MobileOrderRow
                    key={order.id}
                    order={order}
                    step={step}
                    steps={steps}
                    onOpen={() => setSelectedOrder(order)}
                    onMove={moveOrder}
                    formatCurrency={formatCurrency}
                    isViewer={isViewer}
                    canAdvanceStep={canAdvanceStep}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
