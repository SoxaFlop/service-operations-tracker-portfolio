import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { BudgetQuote } from '../types';

export function useBudgetQuotes(isAuthReady: boolean, userUid: string | undefined, isPaused = false) {
  const [budgetQuotes, setBudgetQuotes] = useState<BudgetQuote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pendingIds = useRef<Set<string>>(new Set());

  const token = () => localStorage.getItem('token');

  const fetchBudgetQuotes = useCallback(async () => {
    if (!isAuthReady || !userUid || isPaused) return;
    try {
      const res = await fetch('/api/budget-quotes', {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setBudgetQuotes(prev => {
        if (pendingIds.current.size > 0) return prev;
        return data;
      });
    } catch {
      // silent — polling should not toast on network blip
    }
  }, [isAuthReady, userUid, isPaused]);

  useEffect(() => {
    if (!isAuthReady || !userUid || isPaused) return;
    fetchBudgetQuotes();
    const interval = setInterval(fetchBudgetQuotes, 30000);
    return () => clearInterval(interval);
  }, [isAuthReady, userUid, isPaused, fetchBudgetQuotes]);

  const createBudgetQuote = async (data: Partial<BudgetQuote> & { assigneeIds?: string[] }): Promise<BudgetQuote | null> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/budget-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(data),
      });
      const saved = await res.json();
      if (!res.ok) { toast.error(saved.error ?? 'Failed to create budget quote'); return null; }
      setBudgetQuotes(prev => [saved, ...prev]);
      toast.success('Budget quote created');
      return saved;
    } catch {
      toast.error('Failed to create budget quote');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateBudgetQuote = async (id: string, data: Partial<BudgetQuote> & { assigneeIds?: string[] }): Promise<BudgetQuote | null> => {
    pendingIds.current.add(id);
    try {
      const res = await fetch(`/api/budget-quotes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(data),
      });
      const saved = await res.json();
      if (!res.ok) { toast.error(saved.error ?? 'Failed to update budget quote'); return null; }
      setBudgetQuotes(prev => prev.map(q => (q.id === id ? saved : q)));
      toast.success('Budget quote saved');
      return saved;
    } catch {
      toast.error('Failed to update budget quote');
      return null;
    } finally {
      setTimeout(() => pendingIds.current.delete(id), 2000);
    }
  };

  const deleteBudgetQuote = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/budget-quotes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Failed to delete'); return false; }
      setBudgetQuotes(prev => prev.filter(q => q.id !== id));
      toast.success('Budget quote deleted');
      return true;
    } catch {
      toast.error('Failed to delete budget quote');
      return false;
    }
  };

  const submitBudgetQuote = async (id: string): Promise<BudgetQuote | null> => {
    pendingIds.current.add(id);
    try {
      const res = await fetch(`/api/budget-quotes/${id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const saved = await res.json();
      if (!res.ok) { toast.error(saved.error ?? 'Failed to submit'); return null; }
      setBudgetQuotes(prev => prev.map(q => (q.id === id ? saved : q)));
      toast.success('Submitted for approval');
      return saved;
    } catch {
      toast.error('Failed to submit budget quote');
      return null;
    } finally {
      setTimeout(() => pendingIds.current.delete(id), 2000);
    }
  };

  const approveBudgetQuote = async (id: string, adminNotes?: string): Promise<BudgetQuote | null> => {
    pendingIds.current.add(id);
    try {
      const res = await fetch(`/api/budget-quotes/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ adminNotes }),
      });
      const saved = await res.json();
      if (!res.ok) { toast.error(saved.error ?? 'Failed to approve'); return null; }
      setBudgetQuotes(prev => prev.map(q => (q.id === id ? saved : q)));
      toast.success('Budget quote approved');
      return saved;
    } catch {
      toast.error('Failed to approve budget quote');
      return null;
    } finally {
      setTimeout(() => pendingIds.current.delete(id), 2000);
    }
  };

  const queryBudgetQuote = async (id: string, adminNotes: string): Promise<BudgetQuote | null> => {
    pendingIds.current.add(id);
    try {
      const res = await fetch(`/api/budget-quotes/${id}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ adminNotes }),
      });
      const saved = await res.json();
      if (!res.ok) { toast.error(saved.error ?? 'Failed to query'); return null; }
      setBudgetQuotes(prev => prev.map(q => (q.id === id ? saved : q)));
      toast.success('Query sent to creator');
      return saved;
    } catch {
      toast.error('Failed to query budget quote');
      return null;
    } finally {
      setTimeout(() => pendingIds.current.delete(id), 2000);
    }
  };

  const updateStatus = async (id: string, status: string, subject?: string): Promise<BudgetQuote | null> => {
    pendingIds.current.add(id);
    try {
      const res = await fetch(`/api/budget-quotes/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ status, ...(subject ? { subject } : {}) }),
      });
      const saved = await res.json();
      if (!res.ok) { toast.error(saved.error ?? 'Failed to update status'); return null; }
      setBudgetQuotes(prev => prev.map(q => (q.id === id ? saved : q)));
      return saved;
    } catch {
      toast.error('Failed to update status');
      return null;
    } finally {
      setTimeout(() => pendingIds.current.delete(id), 2000);
    }
  };

  const convertToOrder = async (id: string): Promise<{ order: any; budgetQuote: BudgetQuote } | null> => {
    try {
      const res = await fetch(`/api/budget-quotes/${id}/convert-to-order`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to convert to order'); return null; }
      setBudgetQuotes(prev => prev.map(q => (q.id === id ? data.budgetQuote : q)));
      toast.success('Order created from budget quote');
      return data;
    } catch {
      toast.error('Failed to convert to order');
      return null;
    }
  };

  return {
    budgetQuotes,
    isLoading,
    fetchBudgetQuotes,
    createBudgetQuote,
    updateBudgetQuote,
    deleteBudgetQuote,
    submitBudgetQuote,
    approveBudgetQuote,
    queryBudgetQuote,
    updateStatus,
    convertToOrder,
  };
}
