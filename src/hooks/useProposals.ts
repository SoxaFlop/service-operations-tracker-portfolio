import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Proposal } from '../types';

export function useProposals(isAuthReady: boolean, userUid: string | undefined, isPaused = false) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pendingIds = useRef<Set<string>>(new Set());

  const token = () => localStorage.getItem('token');

  const fetchProposals = useCallback(async () => {
    if (!isAuthReady || !userUid || isPaused) return;
    try {
      const res = await fetch('/api/proposals', {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setProposals(data);
    } catch {
      // silent — polling should not toast on network blip
    }
  }, [isAuthReady, userUid]);

  useEffect(() => {
    if (!isAuthReady || !userUid || isPaused) return;
    fetchProposals();
    const interval = setInterval(fetchProposals, 30000);
    return () => clearInterval(interval);
  }, [isAuthReady, userUid, isPaused, fetchProposals]);

  const createProposal = async (data: Partial<Proposal>): Promise<Proposal | null> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(data),
      });
      const saved = await res.json();
      if (!res.ok) { toast.error(saved.error ?? 'Failed to create proposal'); return null; }
      setProposals(prev => [saved, ...prev]);
      toast.success('Proposal created');
      return saved;
    } catch {
      toast.error('Failed to create proposal');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProposal = async (id: string, data: Partial<Proposal>): Promise<Proposal | null> => {
    pendingIds.current.add(id);
    try {
      const res = await fetch(`/api/proposals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(data),
      });
      const saved = await res.json();
      if (!res.ok) { toast.error(saved.error ?? 'Failed to update proposal'); return null; }
      setProposals(prev => prev.map(p => (p.id === id ? saved : p)));
      toast.success('Proposal saved');
      return saved;
    } catch {
      toast.error('Failed to update proposal');
      return null;
    } finally {
      setTimeout(() => pendingIds.current.delete(id), 2000);
    }
  };

  const deleteProposal = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/proposals/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Failed to delete'); return false; }
      setProposals(prev => prev.filter(p => p.id !== id));
      toast.success('Proposal deleted');
      return true;
    } catch {
      toast.error('Failed to delete proposal');
      return false;
    }
  };

  const submitProposal = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/proposals/${id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Failed to submit'); return false; }
      setProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'pending_approval' } : p));
      toast.success('Proposal submitted for approval');
      return true;
    } catch {
      toast.error('Failed to submit proposal');
      return false;
    }
  };

  const approveProposal = async (id: string, adminNotes?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/proposals/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ adminNotes }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Failed to approve'); return false; }
      setProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'approved', adminNotes } : p));
      toast.success('Proposal approved');
      return true;
    } catch {
      toast.error('Failed to approve proposal');
      return false;
    }
  };

  const queryProposal = async (id: string, adminNotes: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/proposals/${id}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ adminNotes }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Failed to send query'); return false; }
      setProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'queried', adminNotes } : p));
      toast.success('Query sent to Account Manager');
      return true;
    } catch {
      toast.error('Failed to send query');
      return false;
    }
  };

  const sendProposal = async (id: string, subject?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/proposals/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ subject }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Failed to send'); return false; }
      setProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'sent', sentAt: new Date().toISOString() } : p));
      toast.success('Proposal sent to client');
      return true;
    } catch {
      toast.error('Failed to send proposal');
      return false;
    }
  };

  const createOrderFromProposal = async (id: string): Promise<any | null> => {
    try {
      const res = await fetch(`/api/proposals/${id}/create-order`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to create order'); return null; }
      toast.success('Order created from proposal');
      return data;
    } catch {
      toast.error('Failed to create order from proposal');
      return null;
    }
  };

  return {
    proposals,
    isLoading,
    fetchProposals,
    createProposal,
    updateProposal,
    deleteProposal,
    submitProposal,
    approveProposal,
    queryProposal,
    sendProposal,
    createOrderFromProposal,
  };
}
