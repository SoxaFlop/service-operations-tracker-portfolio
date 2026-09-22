import { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, CheckCircle2, PartyPopper, FastForward, Rewind, Loader2, Lock } from 'lucide-react';

const DOC_LABELS: Record<string, string> = {
  onsiteQuoteLink: 'Onsite Quote', technicalQuoteLink: 'Technical Quote',
  salesQuoteLink: 'Sales Quote', proformaInvoiceLink: 'Pro Forma Invoice',
  customerPopLink: 'Customer POP', onsitePurchaseOrderLink: 'Onsite PO',
  onsiteTaxInvoiceLink: 'Onsite Tax Invoice', taxInvoiceLink: 'Tax Invoice',
  customerQuoteLink: 'Customer Quote',
};
import { toast } from 'sonner';
import { Order, OrderStatus } from '../../types';
import { WorkflowStep } from '../../hooks/useSteps';
import { calculateBusinessDays } from '@/lib/utils';

export function OrderCard({
  order,
  onMove,
  formatCurrency,
  steps,
  isAdmin,
  isViewer,
  canAdvanceStep,
}: {
  order: Order;
  onMove: (firestoreId: string, status: OrderStatus) => Promise<void>;
  formatCurrency: (amount?: number) => string;
  steps: WorkflowStep[];
  isAdmin?: boolean;
  isViewer?: boolean;
  canAdvanceStep?: (stepId: string) => boolean;
}) {
  const [isMoving, setIsMoving] = useState(false);
  const currentStatusIndex = steps.findIndex(s => s.id === order.status);
  const nextStatus = currentStatusIndex !== -1 && currentStatusIndex < steps.length - 1 ? steps[currentStatusIndex + 1].id : undefined;
  const nextStepDef = currentStatusIndex !== -1 && currentStatusIndex < steps.length - 1 ? steps[currentStatusIndex + 1] : undefined;
  const skipStatus = currentStatusIndex !== -1 && currentStatusIndex < steps.length - 2 && (nextStepDef?.canSkip !== false) ? steps[currentStatusIndex + 2].id : undefined;
  const skipBackStatus = currentStatusIndex > 1 ? steps[currentStatusIndex - 2].id : undefined;
  const prevStatus = currentStatusIndex > 0 ? steps[currentStatusIndex - 1].id : undefined;
  const progress = steps.length > 0 ? Math.round(((currentStatusIndex + 1) / steps.length) * 100) : 0;

  // True when one more click completes the order
  const isLastStep = steps.length > 0 && nextStatus === steps[steps.length - 1].id;

  const currentStepDef = steps.find(s => s.id === order.status);
  const colorSplit = currentStepDef ? currentStepDef.color.split(' ')[0] : 'bg-slate-100';
  const isExternalTeamStep = currentStepDef?.isExternalTeam === true;

  const currentAudit = order.audits?.find(a => a.step === order.status && !a.completedAt);
  let daysInStep = 0;
  if (currentAudit) {
    daysInStep = calculateBusinessDays(new Date(currentAudit.startedAt), new Date());
  } else {
    daysInStep = calculateBusinessDays(new Date(order.updatedAt), new Date());
  }

  const getBorderColor = (days: number) => {
    if (days < 1) return 'border-emerald-200 hover:shadow-emerald-100';
    if (days < 2) return 'border-lime-300 hover:shadow-lime-100';
    if (days < 3) return 'border-yellow-400 hover:shadow-yellow-100';
    if (days < 4) return 'border-orange-400 hover:shadow-orange-100';
    if (days < 5) return 'border-red-400 hover:shadow-red-500/20';
    return 'border-red-600 border-2 hover:shadow-red-500/40';
  };

  const hasSlaViolation = !isExternalTeamStep && (order.audits || []).some(audit => {
    if (audit.firedCustomAlerts && audit.firedCustomAlerts.length > 0) return true;
    const start = new Date(audit.startedAt);
    const end = audit.completedAt ? new Date(audit.completedAt) : new Date();
    const days = calculateBusinessDays(start, end);
    return days >= 5 || audit.reminder5DaysSent;
  });

  const isActuallyCompleted = steps.length > 0 && currentStatusIndex === steps.length - 1;

  let borderColorClass = isExternalTeamStep
    ? 'border-sky-200 hover:shadow-sky-100'
    : getBorderColor(daysInStep);
  if (!isExternalTeamStep && hasSlaViolation && !isActuallyCompleted) {
    borderColorClass = 'border-red-600 border-2 shadow-red-100 dark:shadow-red-900/30';
  } else if (isActuallyCompleted) {
    if (hasSlaViolation) {
      borderColorClass = 'border-rose-500 border bg-rose-50/20 dark:bg-rose-950/30 opacity-90 shadow-sm shadow-rose-200/50';
    } else {
      borderColorClass = 'border-emerald-500 border hover:shadow-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-950/20 opacity-90';
    }
  }

  const handleNext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.firestoreId || isMoving) return;

    setIsMoving(true);
    try {
      await onMove(order.firestoreId, nextStatus!);
      if (isLastStep) {
        toast.success('Order complete! Tax invoice sent to client.', {
          icon: <PartyPopper size={16} className="text-emerald-500" />,
          duration: 5000,
        });
      }
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Card className={`group shadow-sm hover:shadow-xl transition-all duration-500 cursor-pointer overflow-hidden bg-card rounded-3xl relative ${borderColorClass}`}>
        <div className={`absolute top-0 left-0 w-1 h-full ${colorSplit}`} />

        <CardHeader className="p-5 pb-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-muted-foreground/50 tracking-[0.2em] uppercase">{order.id}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground">{progress}%</span>
              <div className="w-8 h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
          <CardTitle className="text-base font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
            {order.clientName}
          </CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {order.products && order.products.length > 0 ? (
              <>
                <Badge variant="secondary" className="bg-muted text-muted-foreground border-none text-[9px] font-bold px-1.5 py-0 h-4 rounded-md truncate max-w-[120px]">
                  {order.products[0].name}
                </Badge>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[9px] font-bold px-1.5 py-0 h-4 rounded-md">
                  {order.products.length > 1 ? `+${order.products.length - 1} more` : `${order.products[0].quantity} Units`}
                </Badge>
              </>
            ) : (
              <>
                <Badge variant="secondary" className="bg-muted text-muted-foreground border-none text-[9px] font-bold px-1.5 py-0 h-4 rounded-md truncate max-w-[120px]">
                  {order.licenseType}
                </Badge>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[9px] font-bold px-1.5 py-0 h-4 rounded-md">
                  {order.licenseCount || 1} Units
                </Badge>
              </>
            )}
            {(order.category || (order.products && order.products[0]?.category)) === 'tech_product' && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-none text-[9px] font-bold px-1.5 py-0 h-4 rounded-md">
                Tech
              </Badge>
            )}
            {isExternalTeamStep && !isActuallyCompleted && (
              <Badge variant="secondary" className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-none text-[9px] font-bold px-1.5 py-0 h-4 rounded-md">
                External
              </Badge>
            )}
            {isActuallyCompleted && (
              <Badge variant="secondary" className={`${hasSlaViolation ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'} border-none text-[9px] font-bold px-1.5 py-0 h-4 rounded-md tracking-wider`}>
                {hasSlaViolation ? 'COMPLETED (LATE)' : 'COMPLETED'}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">Value</span>
              <span className="text-xs font-bold text-foreground">
                {formatCurrency(order.quoteAmount || (order.products || []).reduce((sum, p) => sum + (p.lineTotal || 0), 0))}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">Owner</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground">{order.assignedTo?.split(' ')[0]}</span>
                <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                  {order.assignedTo?.[0]}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4 border-t border-border/50">
            {!isViewer && prevStatus ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={isMoving}
                className="h-8 flex-1 text-[10px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl gap-1.5"
                onClick={async (e: React.MouseEvent) => {
                   e.stopPropagation();
                   if (order.firestoreId && !isMoving) {
                     setIsMoving(true);
                     try {
                       await onMove(order.firestoreId, prevStatus);
                     } finally {
                       setIsMoving(false);
                     }
                   }
                }}
              >
                {isMoving ? <Loader2 size={12} className="animate-spin" /> : <ArrowLeft size={12} />}
                {isMoving ? 'Moving...' : 'Back'}
              </Button>
            ) : <div className="flex-1" />}

            {!isViewer && isAdmin && (skipStatus || skipBackStatus) && (
              <div className="flex flex-col gap-1 flex-1">
                {skipStatus && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isMoving}
                    className="h-7 w-full text-[9px] font-bold text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 rounded-lg gap-1 px-1"
                    onClick={async (e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (order.firestoreId && !isMoving) {
                        setIsMoving(true);
                        try {
                          await onMove(order.firestoreId, skipStatus);
                          toast.success('Step skipped successfully.');
                        } finally {
                          setIsMoving(false);
                        }
                      }
                    }}
                  >
                    {isMoving ? <Loader2 size={10} className="animate-spin" /> : 'Skip Fwd'}
                    {!isMoving && <FastForward size={10} />}
                  </Button>
                )}
                {skipBackStatus && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isMoving}
                    className="h-7 w-full text-[9px] font-bold text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 rounded-lg gap-1 px-1"
                    onClick={async (e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (order.firestoreId && !isMoving) {
                        setIsMoving(true);
                        try {
                          await onMove(order.firestoreId, skipBackStatus);
                          toast.success('Skipped backward successfully.');
                        } finally {
                          setIsMoving(false);
                        }
                      }
                    }}
                  >
                    {isMoving ? <Loader2 size={10} className="animate-spin" /> : <Rewind size={10} />}
                    {isMoving ? 'Moving...' : 'Skip Back'}
                  </Button>
                )}
              </div>
            )}

            {!isViewer && nextStatus && (canAdvanceStep ? canAdvanceStep(order.status) : true) ? (
              order.advanceBlocked ? (
                <div className="flex-1 flex flex-col items-stretch gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    className="h-8 text-[10px] font-bold text-amber-600/70 rounded-xl gap-1.5 cursor-not-allowed opacity-70 bg-amber-50 dark:bg-amber-900/20"
                  >
                    <Lock size={11} />
                    Next
                  </Button>
                  <p className="text-[9px] text-amber-600/80 text-center leading-tight px-1 truncate" title={`Missing: ${order.missingRequiredDocs?.map(d => DOC_LABELS[d] ?? d).join(', ')}`}>
                    Missing: {order.missingRequiredDocs?.map(d => DOC_LABELS[d] ?? d).join(', ')}
                  </p>
                </div>
              ) : (
                <Button
                  variant={isLastStep ? 'default' : 'ghost'}
                  size="sm"
                  disabled={isMoving}
                  className={
                    isLastStep
                      ? 'h-8 flex-1 text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl gap-1.5 shadow-sm shadow-emerald-200'
                      : 'h-8 flex-1 text-[10px] font-bold text-primary hover:text-primary hover:bg-primary/10 rounded-xl gap-1.5'
                  }
                  onClick={handleNext}
                >
                  {isMoving ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Moving to next step...
                    </>
                  ) : isLastStep ? (
                    <>
                      <CheckCircle2 size={12} />
                      Complete Order
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight size={12} />
                    </>
                  )}
                </Button>
              )
            ) : (
              <div className="flex-1 flex justify-center">
                <CheckCircle2 size={16} className="text-emerald-400" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
