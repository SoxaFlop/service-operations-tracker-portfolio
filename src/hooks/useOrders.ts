import { useState, useEffect, useRef } from 'react';
import { Order, OrderStatus } from '../types';
import { WorkflowStep } from './useSteps';
import { toast } from 'sonner';

const TERMINAL_STATUSES = ['quote_expired', 'quote_rejected'];

function mapOrder(d: any, steps: WorkflowStep[]): Order {
  let status = d.status;
  // Normalise unknown statuses to the first step, but never remap terminal statuses
  if (steps.length > 0 && !steps.find(s => s.id === status) && !TERMINAL_STATUSES.includes(status)) {
    status = steps[0].id;
  }
  return { ...d, status, firestoreId: d.dbId };
}

export function useOrders(
  isAuthReady: boolean,
  userUid: string | undefined,
  userDisplayName: string | null | undefined,
  userEmail: string | null | undefined,
  steps: WorkflowStep[],
  isPaused: boolean = false
) {
  const [orders, setOrders] = useState<Order[]>([]);

  // Use a ref to track orders currently being updated to prevent poll-overwrites (bouncing)
  const pendingIds = useRef<Set<string>>(new Set());

  const fetchOrders = async (retryCount = 0): Promise<void> => {
    if (isPaused) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();

      const mapped = data.map((d: any) => mapOrder(d, steps));

      setOrders(prev => {
        const prevMap = new Map((prev || []).map(o => [o.firestoreId || o.id, o]));

        return mapped.map((newOrder: Order) => {
          const id = newOrder.firestoreId || newOrder.id;
          // If this order is currently being updated locally, preserve the local state
          if (pendingIds.current.has(id)) {
            const localOrder = prevMap.get(id);
            if (localOrder) return localOrder;
          }
          return newOrder;
        });
      });
    } catch (error) {
      console.error(`Error fetching orders (attempt ${retryCount + 1}):`, error);
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => fetchOrders(retryCount + 1), delay);
      } else {
        toast.error('Failed to load orders');
      }
    }
  };

  useEffect(() => {
    if (!isAuthReady || !userUid || steps.length === 0 || isPaused) return;
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [isAuthReady, userUid, steps.length, isPaused]);

  const moveOrder = async (firestoreId: string, newStatus: OrderStatus) => {
    pendingIds.current.add(firestoreId);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/orders/${firestoreId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to move order');
      }

      const saved = await response.json();
      // Only update state after server confirmation
      setOrders(prev => prev.map(o =>
        o.firestoreId === firestoreId ? mapOrder(saved, steps) : o
      ));
    } catch (error: any) {
      console.error('Error moving order:', error);
      toast.error(error?.message || 'Failed to update order status');
    } finally {
      // Delay removal to ensure server has definitely updated by next poll
      setTimeout(() => pendingIds.current.delete(firestoreId), 2000);
    }
  };

  const updateOrder = async (updatedOrder: Order) => {
    const id = updatedOrder.firestoreId || updatedOrder.id;
    if (!id) return;

    pendingIds.current.add(id);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updatedOrder)
      });
      if (!response.ok) throw new Error('Failed to update order');

      const saved = await response.json();
      // Only update state after server confirmation
      setOrders(prev => prev.map(o =>
        (o.firestoreId === id || o.id === id) ? mapOrder(saved, steps) : o
      ));
      toast.success('Order details updated');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    } finally {
      setTimeout(() => pendingIds.current.delete(id), 2000);
    }
  };

  const deleteOrder = async (firestoreId: string) => {
    const previous = orders;
    setOrders(prev => prev.filter(o => o.firestoreId !== firestoreId));

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/orders/${firestoreId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete order');
      toast.error('Order deleted');
    } catch (error) {
      setOrders(previous);
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order');
    }
  };

  const createOrder = async (newOrder: Partial<Order>) => {
    if (!newOrder.clientName || (!newOrder.licenseType && (!newOrder.products || newOrder.products.length === 0))) {
      toast.error('Please fill in required fields');
      return false;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newOrder)
      });
      if (!response.ok) throw new Error('Failed to create order');
      const created = await response.json();
      setOrders(prev => [mapOrder(created, steps), ...prev]);
      toast.success('New order created');
      return true;
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create new order');
      return false;
    }
  };

  const getOrderDetails = async (firestoreId: string): Promise<Order | null> => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/orders/${firestoreId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch order details');
      const data = await response.json();
      return mapOrder(data, steps);
    } catch (error) {
      console.error('Error fetching order details:', error);
      toast.error('Failed to load order details');
      return null;
    }
  };

  return { orders, moveOrder, updateOrder, deleteOrder, createOrder, getOrderDetails, setOrders };
}
