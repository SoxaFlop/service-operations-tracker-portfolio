import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export interface WorkflowStep {
  id: string;
  label: string;
  color: string;
  position: number;
  canSkip: boolean;
  isExternalTeam: boolean;
  clientReminderEnabled: boolean;
}

export function useSteps(isAuthReady: boolean) {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSteps = async () => {
    if (!isAuthReady) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch('/api/settings/steps', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSteps(data.sort((a: any, b: any) => a.position - b.position));
      }
    } catch (e) {
      console.error('Failed to load steps:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthReady) return;
    fetchSteps();
    const interval = setInterval(fetchSteps, 30000); // poll every 30s so all users see changes
    return () => clearInterval(interval);
  }, [isAuthReady]);

  const addStep = async (step: Partial<WorkflowStep>) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/settings/steps', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(step)
      });
      if (!res.ok) throw new Error('Failed to add step');
      await fetchSteps();
      toast.success('Step added');
    } catch {
      toast.error('Failed to add step');
    }
  };

  const updateStep = async (id: string, step: Partial<WorkflowStep>) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/settings/steps/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(step)
      });
      if (!res.ok) throw new Error('Failed to update step');
      await fetchSteps();
      toast.success('Step updated');
    } catch {
      toast.error('Failed to update step');
    }
  };

  const deleteStep = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/settings/steps/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete step');
      await fetchSteps();
      toast.success('Step deleted');
    } catch {
      toast.error('Failed to delete step');
    }
  };

  const reorderSteps = async (orderedIds: string[]) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/settings/steps/reorder', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: orderedIds })
      });
      if (!res.ok) throw new Error('Failed to reorder');
      await fetchSteps();
    } catch {
      toast.error('Failed to reorder steps');
    }
  };

  return { steps, isStepsReady: !isLoading, addStep, updateStep, deleteStep, reorderSteps, fetchSteps };
}
