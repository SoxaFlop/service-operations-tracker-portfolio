import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, CheckCircle2, ChevronRight, AlertTriangle, XCircle, RotateCcw, Clock } from 'lucide-react';
import { Order } from '../../types';
import { WorkflowStep } from '../../hooks/useSteps';
import { calculateBusinessDays } from '@/lib/utils';

interface CompletedOrdersViewProps {
  completedOrders: Order[];
  formatCurrency: (amount?: number) => string;
  setSelectedOrder: (order: Order) => Promise<void>;
  steps: WorkflowStep[];
  moveOrder?: (id: string, status: string) => Promise<void>;
  isAdmin?: boolean;
}

function RenewPopover({ orderId, steps, moveOrder, onClose }: {
  orderId: string;
  steps: WorkflowStep[];
  moveOrder: (id: string, status: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedStep, setSelectedStep] = useState(steps[0]?.id || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleRenew = async () => {
    if (!selectedStep) return;
    setIsLoading(true);
    try {
      await moveOrder(orderId, selectedStep);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-3 p-3 bg-slate-50 dark:bg-muted/20 border border-border rounded-xl space-y-2" onClick={e => e.stopPropagation()}>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Move back to step</p>
      <select
        value={selectedStep}
        onChange={e => setSelectedStep(e.target.value)}
        className="w-full text-xs rounded-lg border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {steps.map(s => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleRenew} disabled={isLoading || !selectedStep}
          className="flex-1 h-7 text-[10px] rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white">
          {isLoading ? 'Moving...' : 'Confirm Renew'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose} className="h-7 text-[10px] rounded-lg">
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface OrderCardProps {
  order: Order;
  formatCurrency: (amount?: number) => string;
  setSelectedOrder: (order: Order) => Promise<void>;
  steps: WorkflowStep[];
  moveOrder?: (id: string, status: string) => Promise<void>;
  isAdmin?: boolean;
  renewingOrderId: string | null;
  setRenewingOrderId: (id: string | null) => void;
}

function OrderCard({ order, formatCurrency, setSelectedOrder, steps, moveOrder, isAdmin, renewingOrderId, setRenewingOrderId }: OrderCardProps) {
  const isExpired = order.status === 'quote_expired';
  const isRejected = order.status === 'quote_rejected';
  const isSpecial = isExpired || isRejected;
  const orderId = order.firestoreId || order.id;
  const isRenewing = renewingOrderId === orderId;

  const hasDelayedInvoice = !isSpecial && (order.audits || []).some(audit => {
    const start = new Date(audit.startedAt);
    const end = audit.completedAt ? new Date(audit.completedAt) : new Date();
    const days = Math.ceil(calculateBusinessDays(start, end));
    return days > 5 && audit.step.toLowerCase().includes('invoice');
  });

  const cardBorderClass = isExpired
    ? 'border-amber-400 bg-amber-50/20 dark:bg-amber-900/10'
    : isRejected
      ? 'border-orange-400 bg-orange-50/20 dark:bg-orange-900/10'
      : order.slaViolation
        ? 'border-red-400 bg-red-50/20 dark:bg-red-900/10'
        : hasDelayedInvoice
          ? 'border-red-500 bg-red-50/30'
          : 'border-border/50';

  const iconBgClass = isExpired
    ? 'bg-amber-500/10 text-amber-500'
    : isRejected
      ? 'bg-orange-500/10 text-orange-500'
      : order.slaViolation
        ? 'bg-red-500/10 text-red-500'
        : 'bg-emerald-500/10 text-emerald-500';

  const StatusIcon = isSpecial ? XCircle : order.slaViolation ? AlertTriangle : CheckCircle2;

  return (
    <Card
      className={`border shadow-sm hover:shadow-md transition-all cursor-pointer rounded-2xl overflow-hidden bg-card ${cardBorderClass}`}
      onClick={() => setSelectedOrder(order)}
    >
      <div className="flex items-start p-4 gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${iconBgClass}`}>
          <StatusIcon size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">{order.id}</span>
            <Badge variant="outline" className="text-[9px] font-bold text-primary/70 border-primary/20 rounded-full uppercase">
              {order.category === 'device_management' ? 'Device Management' : order.category === 'sales' ? 'Sales' : order.category === 'training' ? 'Training' : 'Tech Services'}
            </Badge>
            {order.slaViolation && !isSpecial && (
              <Badge className="text-[9px] font-bold bg-red-500/10 text-red-600 border-red-300 rounded-full uppercase">
                SLA Violated
              </Badge>
            )}
            {isExpired && (
              <Badge className="text-[9px] font-bold bg-amber-500/10 text-amber-700 border-amber-300 rounded-full uppercase">
                No POP — Quote Expired
              </Badge>
            )}
            {isRejected && (
              <Badge className="text-[9px] font-bold bg-orange-500/10 text-orange-700 border-orange-300 rounded-full uppercase">
                Customer Rejected Quote
              </Badge>
            )}
          </div>
          <h3 className="font-bold text-foreground truncate">{order.clientName}</h3>
          <p className="text-xs text-muted-foreground">
            {order.products && order.products.length > 0
              ? `${order.products[0].name} ${order.products.length > 1 ? `(+${order.products.length - 1} more)` : `• ${order.products[0].quantity} Units`}`
              : `${order.licenseType} • ${order.licenseCount} Units`}
          </p>
          {isAdmin && isSpecial && moveOrder && (
            <div onClick={e => e.stopPropagation()}>
              <Button
                size="sm"
                variant="outline"
                onClick={e => {
                  e.stopPropagation();
                  setRenewingOrderId(isRenewing ? null : orderId);
                }}
                className="mt-2 h-7 text-[10px] rounded-lg gap-1 border-indigo-500/30 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
              >
                <RotateCcw size={11} /> Renew Order
              </Button>
              {isRenewing && (
                <RenewPopover
                  orderId={orderId}
                  steps={steps}
                  moveOrder={moveOrder}
                  onClose={() => setRenewingOrderId(null)}
                />
              )}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0 self-start">
          <p className="text-sm font-bold text-foreground">
            {formatCurrency(order.quoteAmount || (order.products || []).reduce((sum, p) => sum + (p.lineTotal || 0), 0))}
          </p>
          <p className="text-[10px] text-muted-foreground font-bold uppercase">
            {isExpired ? 'Expired' : isRejected ? 'Rejected' : 'Completed'}{' '}
            {new Date(order.updatedAt).toLocaleDateString()}
          </p>
        </div>
        {!isRenewing && <ChevronRight size={20} className="text-muted-foreground/30 flex-shrink-0 self-center" />}
      </div>
    </Card>
  );
}

type Tab = 'completed' | 'expired' | 'rejected';

const TABS: { id: Tab; label: string; icon: React.ReactNode; activeClass: string; countClass: string }[] = [
  {
    id: 'completed',
    label: 'Completed',
    icon: <CheckCircle2 size={14} />,
    activeClass: 'bg-emerald-500 text-white shadow-sm shadow-emerald-200',
    countClass: 'bg-white/20',
  },
  {
    id: 'expired',
    label: 'No POP — Quote Expired',
    icon: <Clock size={14} />,
    activeClass: 'bg-amber-500 text-white shadow-sm shadow-amber-200',
    countClass: 'bg-white/20',
  },
  {
    id: 'rejected',
    label: 'Quote Declined',
    icon: <XCircle size={14} />,
    activeClass: 'bg-orange-500 text-white shadow-sm shadow-orange-200',
    countClass: 'bg-white/20',
  },
];

export function CompletedOrdersView({ completedOrders, formatCurrency, setSelectedOrder, steps, moveOrder, isAdmin }: CompletedOrdersViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('completed');
  const [renewingOrderId, setRenewingOrderId] = useState<string | null>(null);

  const completedOnly = completedOrders.filter(o => o.status !== 'quote_expired' && o.status !== 'quote_rejected');
  const expiredOrders = completedOrders.filter(o => o.status === 'quote_expired');
  const rejectedOrders = completedOrders.filter(o => o.status === 'quote_rejected');

  const countByTab: Record<Tab, number> = {
    completed: completedOnly.length,
    expired: expiredOrders.length,
    rejected: rejectedOrders.length,
  };

  const visibleOrders = activeTab === 'completed' ? completedOnly : activeTab === 'expired' ? expiredOrders : rejectedOrders;

  const cardProps = { formatCurrency, setSelectedOrder, steps, moveOrder, isAdmin, renewingOrderId, setRenewingOrderId };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Order History</h2>
        <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/20 rounded-full px-3 py-1">
          {completedOrders.length} Total
        </Badge>
      </div>

      {/* Tab buttons */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isActive
                  ? tab.activeClass
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
            >
              {tab.icon}
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${isActive ? tab.countClass : 'bg-background/60'}`}>
                {countByTab[tab.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Order list */}
      {visibleOrders.length > 0 ? (
        <div className="grid gap-4">
          {visibleOrders.map(order => (
            <OrderCard key={order.id} order={order} {...cardProps} />
          ))}
        </div>
      ) : completedOrders.length === 0 ? (
        <div className="text-center py-20 bg-slate-50/50 dark:bg-muted/20 rounded-[2.5rem] border border-dashed border-slate-100 dark:border-border">
          <History size={48} className="mx-auto text-slate-200 dark:text-muted-foreground/20 mb-4" />
          <p className="text-slate-400 dark:text-muted-foreground font-medium">No order history yet.</p>
        </div>
      ) : (
        <div className="text-center py-16 bg-slate-50/50 dark:bg-muted/20 rounded-2xl border border-dashed border-slate-100 dark:border-border">
          <p className="text-slate-400 dark:text-muted-foreground text-sm font-medium">No orders in this category.</p>
        </div>
      )}
    </div>
  );
}
