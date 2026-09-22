import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { OrderCard } from './OrderCard';
import { Order, OrderStatus } from '../../types';
import { WorkflowStep } from '../../hooks/useSteps';

interface OrderKanbanProps {
  activeOrders: Order[];
  setSelectedOrder: (order: Order) => Promise<void>;
  moveOrder: (firestoreId: string, newStatus: OrderStatus) => Promise<void>;
  formatCurrency: (amount?: number) => string;
  steps: WorkflowStep[];
  isAdmin?: boolean;
  isViewer?: boolean;
  canAdvanceStep: (stepId: string) => boolean;
}

export function OrderKanban({ activeOrders, setSelectedOrder, moveOrder, formatCurrency, steps, isAdmin, isViewer, canAdvanceStep }: OrderKanbanProps) {
  if (steps.length === 0) return null;

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex gap-8 pb-4">
        {steps.slice(0, -1).map((stepDef, idx) => (
          <div key={stepDef.id} className="w-80 shrink-0 flex flex-col gap-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex flex-col gap-1">
                <h3 className="font-bold text-foreground text-sm tracking-tight">
                  {stepDef.label}
                </h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-card border-border text-muted-foreground font-bold text-[10px] px-1.5 py-0 h-4">
                    {activeOrders.filter(o => o.status === stepDef.id).length}
                  </Badge>
                  <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                    Step {stepDef.position} of {steps.length - 1}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-5 bg-muted/20 p-3 rounded-[2rem] border border-border/50 min-h-[600px]">
              {activeOrders
                .filter(order => order.status === stepDef.id)
                .map((order) => (
                  <div key={order.id} onClick={(e) => {
                    if (!(e.target as HTMLElement).closest('button')) {
                      setSelectedOrder(order);
                    }
                  }}>
                    <OrderCard
                      order={order}
                      onMove={moveOrder}
                      formatCurrency={formatCurrency}
                      steps={steps}
                      isAdmin={isAdmin}
                      isViewer={isViewer}
                      canAdvanceStep={canAdvanceStep}
                    />
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
