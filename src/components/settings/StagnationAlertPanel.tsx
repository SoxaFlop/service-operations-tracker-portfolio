import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Settings2, Plus, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile } from '../../types';

interface StagnationAlertPanelProps {
  stepId: string;
  users: UserProfile[];
  alerts: any[];
  onAlertsChange: (alerts: any[]) => void;
}

export function StagnationAlertPanel({ stepId, users, alerts, onAlertsChange }: StagnationAlertPanelProps) {
  const stepAlerts = alerts.filter(a => a.stepId === stepId);

  const [isAdding, setIsAdding] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newHours, setNewHours] = useState('24');

  const token = () => localStorage.getItem('token');

  const handleAdd = async () => {
    if (!newUserId) { toast.error('Please select a user to notify'); return; }
    const hours = parseInt(newHours);
    if (isNaN(hours) || hours <= 0 || hours > 300) {
      toast.error('Please enter a valid number of hours (max 300)');
      return;
    }
    try {
      const res = await fetch('/api/settings/custom-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ stepId, hours, userId: newUserId }),
      });
      const created = await res.json();
      onAlertsChange([...alerts, created]);
      setIsAdding(false);
      setNewUserId('');
      setNewHours('24');
    } catch {
      toast.error('Failed to create stagnation alert');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/settings/custom-alerts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      onAlertsChange(alerts.filter(a => a.id !== id));
    } catch {
      toast.error('Failed to delete alert');
    }
  };

  return (
    <div className="bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-200/50 dark:border-amber-900/30 ml-5 mt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Settings2 size={12} className="text-amber-600 dark:text-amber-500" />
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest">Custom Stagnation Alerts</span>
        </div>
        {!isAdding && (
          <button
            onClick={() => { setIsAdding(true); setNewHours('24'); setNewUserId(''); }}
            className="bg-background border border-border rounded-md px-2 py-1 flex items-center gap-1 text-xs hover:bg-muted text-muted-foreground shadow-sm transition-colors"
          >
            <Plus size={10} /> Add Alert
          </button>
        )}
      </div>

      <div className="space-y-2">
        {stepAlerts.map(alert => (
          <div key={alert.id} className="flex justify-between items-center bg-background border border-border p-2 rounded-lg text-xs group">
            <div>
              <div className="font-bold">{alert.user?.displayName || 'Unknown User'}</div>
              <div className="text-[10px] text-muted-foreground">After {alert.hours} hours</div>
            </div>
            <Button
              type="button" variant="ghost" size="icon"
              onClick={() => handleDelete(alert.id)}
              className="h-6 w-6 text-red-500/70 hover:bg-red-500/10 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
            >
              <Trash2 size={12} />
            </Button>
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="mt-3 p-3 bg-background border border-border rounded-xl space-y-3 shadow-sm">
          <div className="grid gap-1">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Recipient User</span>
            <select
              value={newUserId}
              onChange={e => setNewUserId(e.target.value)}
              className="h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
            >
              <option value="">Select User</option>
              {users.map(u => (
                <option key={u.uid} value={u.uid}>{u.displayName} ({u.email})</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Wait Time (Hours)</span>
            <Input
              type="number" min="1" max="300" placeholder="e.g. 24"
              value={newHours}
              onChange={e => setNewHours(e.target.value)}
              className="h-8 text-xs rounded-lg bg-background"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleAdd} className="rounded-lg h-7 px-3 text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white border-transparent">
              <Check size={11} /> Save Alert
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="rounded-lg h-7 px-3 text-xs">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {stepAlerts.length === 0 && !isAdding && (
        <p className="text-[10px] text-muted-foreground/50 italic text-center py-2">No custom stagnation alerts</p>
      )}
    </div>
  );
}
