import { motion } from 'motion/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DashboardStats } from '../dashboard/DashboardStats';
import { OrderKanban } from '../orders/OrderKanban';
import { MobileOrderList } from '../orders/MobileOrderList';
import { Order, OrderStatus } from '../../types';
import { WorkflowStep } from '../../hooks/useSteps';

interface DashboardViewProps {
  orders: Order[];
  activeOrders: Order[];
  completedOrders: Order[];
  steps: WorkflowStep[];
  isAdmin: boolean;
  isViewer: boolean;
  searchQuery: string;
  activeCategory: 'all' | 'device_management' | 'tech_product' | 'sales' | 'training';
  setSelectedOrder: (order: Order) => Promise<void>;
  moveOrder: (firestoreId: string, newStatus: string) => Promise<void>;
  formatCurrency: (amount?: number) => string;
  canAdvanceStep: (stepId: string) => boolean;
}

export function DashboardView({
  orders,
  activeOrders,
  completedOrders,
  steps,
  isAdmin,
  isViewer,
  setSelectedOrder,
  moveOrder,
  formatCurrency,
  canAdvanceStep,
}: DashboardViewProps) {
  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="h-full"
    >
      <ScrollArea className="h-full w-full">
        {/* Mobile list view */}
        <div className="md:hidden p-4 space-y-6 pb-6">
          <DashboardStats
            orders={orders}
            activeOrders={activeOrders}
            completedOrders={completedOrders}
            formatCurrency={formatCurrency}
          />
          <MobileOrderList
            activeOrders={activeOrders}
            steps={steps}
            setSelectedOrder={setSelectedOrder}
            moveOrder={moveOrder as (id: string, status: OrderStatus) => Promise<void>}
            formatCurrency={formatCurrency}
            isViewer={isViewer}
            canAdvanceStep={canAdvanceStep}
          />
        </div>

        {/* Desktop kanban view */}
        <div className="hidden md:block p-8 space-y-8 min-h-full">
          <DashboardStats
            orders={orders}
            activeOrders={activeOrders}
            completedOrders={completedOrders}
            formatCurrency={formatCurrency}
          />
          <OrderKanban
            activeOrders={activeOrders}
            setSelectedOrder={setSelectedOrder}
            moveOrder={moveOrder}
            formatCurrency={formatCurrency}
            steps={steps}
            isAdmin={isAdmin}
            isViewer={isViewer}
            canAdvanceStep={canAdvanceStep}
          />
        </div>
      </ScrollArea>
    </motion.div>
  );
}
