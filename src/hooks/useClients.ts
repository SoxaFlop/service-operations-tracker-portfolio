import { useState, useEffect, useCallback } from 'react';
import { Client } from '../types';
import { toast } from 'sonner';

export function useClients(isAuthReady: boolean, userUid: string | undefined, { allClients = false } = {}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchClients = useCallback(async (retryCount = 0): Promise<void> => {
    try {
      const token = localStorage.getItem('token');
      const url = allClients ? '/api/clients?all=true' : '/api/clients';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch clients');
      setClients(await res.json());
      setIsLoading(false);
    } catch (err) {
      console.error(`Fetch clients error (attempt ${retryCount + 1}):`, err);
      if (retryCount < 3) {
        // Exponential backoff: 1s, 2s, 4s — keeps skeleton visible
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => fetchClients(retryCount + 1), delay);
      } else {
        // All retries exhausted — show empty state
        setIsLoading(false);
      }
    }
  }, [allClients]);

  useEffect(() => {
    if (!isAuthReady || !userUid) return;
    fetchClients();
  }, [isAuthReady, userUid, fetchClients]);

  const createClient = async (data: { name: string; contactName: string; email: string; ccEmails?: string; bdmIds?: string[] }) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to create client');
        return false;
      }
      toast.success('Client created');
      await fetchClients();
      return true;
    } catch {
      toast.error('Failed to create client');
      return false;
    }
  };

  const updateClient = async (id: string, data: Partial<Client>) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) { toast.error('Failed to update client'); return false; }
      toast.success('Client updated');
      await fetchClients();
      return true;
    } catch {
      toast.error('Failed to update client');
      return false;
    }
  };

  const deleteClient = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) { toast.error('Failed to delete client'); return false; }
      toast.success('Client removed');
      await fetchClients();
      return true;
    } catch {
      toast.error('Failed to delete client');
      return false;
    }
  };

  return { clients, isLoading, fetchClients, createClient, updateClient, deleteClient };
}
