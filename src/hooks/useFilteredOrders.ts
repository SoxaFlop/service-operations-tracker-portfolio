import { useMemo } from 'react';
import { Order } from '../types';
import { WorkflowStep } from './useSteps';

export function useFilteredOrders(
  orders: Order[],
  searchQuery: string,
  activeCategory: 'all' | 'device_management' | 'tech_product' | 'sales' | 'training',
  steps: WorkflowStep[]
) {
  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return orders.filter(order => {
      const clientBdmNames = [
        order.client?.bdm?.displayName,
        ...(order.client?.bdms?.map(b => b.displayName) ?? []),
        order.bdm?.displayName,
      ].filter(Boolean) as string[];

      const matchesSearch = !q ||
        order.clientName.toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q) ||
        clientBdmNames.some(name => name.toLowerCase().includes(q));

      const matchesCategory = activeCategory === 'all' || order.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [orders, searchQuery, activeCategory]);

  const TERMINAL_STATUSES = ['quote_expired', 'quote_rejected'];

  const activeOrders = useMemo(() => {
    const lastStep = steps.length > 0 ? steps[steps.length - 1].id : 'tax_invoice_shared';
    return filteredOrders.filter(o => o.status !== lastStep && !TERMINAL_STATUSES.includes(o.status));
  }, [filteredOrders, steps]);

  const completedOrders = useMemo(() => {
    const lastStep = steps.length > 0 ? steps[steps.length - 1].id : 'tax_invoice_shared';
    return filteredOrders.filter(o => o.status === lastStep || TERMINAL_STATUSES.includes(o.status));
  }, [filteredOrders, steps]);

  return { activeOrders, completedOrders };
}
