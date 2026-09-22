import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile } from '../../types';

interface DateRangeSlaPanelProps {
  stepId: string;
  users: UserProfile[];
  rules: any[];
  onRulesChange: (rules: any[]) => void;
}

export function DateRangeSlaPanel({ stepId, users, rules, onRulesChange }: DateRangeSlaPanelProps) {
  const stepRules = rules.filter(r => r.stepId === stepId);

  const [isAdding, setIsAdding] = useState(false);
  const [fromDay, setFromDay] = useState('1');
  const [toDay, setToDay] = useState('25');
  const [hours, setHours] = useState('9');
  const [userId, setUserId] = useState('');

  const token = () => localStorage.getItem('token');

  const handleAdd = async () => {
    const from = parseInt(fromDay);
    const to = parseInt(toDay);
    const h = parseInt(hours);
    if (isNaN(from) || isNaN(to) || isNaN(h) || from < 1 || to > 31 || from > to || h <= 0) {
      toast.error('Check days (1–31, from ≤ to) and hours (> 0)');
      return;
    }
    try {
      const res = await fetch('/api/settings/date-range-sla-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ stepId, fromDay: from, toDay: to, hours: h, userId: userId || null }),
      });
      const created = await res.json();
      onRulesChange([...rules, created]);
      setIsAdding(false);
      setFromDay('1'); setToDay('25'); setHours('9'); setUserId('');
    } catch {
      toast.error('Failed to create date-range SLA rule');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/settings/date-range-sla-rules/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      onRulesChange(rules.filter(r => r.id !== id));
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">📅 Date-Range SLA Rules</span>
        {!isAdding && (
          <button
            onClick={() => { setIsAdding(true); setFromDay('1'); setToDay('25'); setHours('9'); setUserId(''); }}
            className="bg-background border border-border rounded-md px-2 py-1 flex items-center gap-1 text-xs hover:bg-muted text-muted-foreground shadow-sm transition-colors"
          >
            <Plus size={10} /> Add Rule
          </button>
        )}
      </div>

      <div className="space-y-2">
        {stepRules.map(rule => (
          <div key={rule.id} className="flex justify-between items-center bg-background border border-border p-2 rounded-lg text-xs group">
            <div>
              <div className="font-bold">Days {rule.fromDay}–{rule.toDay}: {rule.hours}h threshold</div>
              <div className="text-[10px] text-muted-foreground">
                {rule.userId ? (rule.user?.displayName ?? 'Specific user') : 'All assigned users'}
              </div>
            </div>
            <Button
              type="button" variant="ghost" size="icon"
              onClick={() => handleDelete(rule.id)}
              className="h-6 w-6 text-red-500/70 hover:bg-red-500/10 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
            >
              <Trash2 size={12} />
            </Button>
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="mt-3 p-3 bg-background border border-border rounded-xl space-y-3 shadow-sm">
          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-1">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">From Day</span>
              <Input type="number" min="1" max="31" value={fromDay} onChange={e => setFromDay(e.target.value)} className="h-8 text-xs rounded-lg bg-background" />
            </div>
            <div className="grid gap-1">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">To Day</span>
              <Input type="number" min="1" max="31" value={toDay} onChange={e => setToDay(e.target.value)} className="h-8 text-xs rounded-lg bg-background" />
            </div>
            <div className="grid gap-1">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Hours</span>
              <Input type="number" min="1" value={hours} onChange={e => setHours(e.target.value)} className="h-8 text-xs rounded-lg bg-background" />
            </div>
          </div>
          <div className="grid gap-1">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Specific User (optional)</span>
            <select
              value={userId}
              onChange={e => setUserId(e.target.value)}
              className="h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
            >
              <option value="">All assigned users</option>
              {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleAdd} className="rounded-lg h-7 px-3 text-xs gap-1 bg-blue-500 hover:bg-blue-600 text-white border-transparent">
              <Check size={11} /> Save Rule
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="rounded-lg h-7 px-3 text-xs">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {stepRules.length === 0 && !isAdding && (
        <p className="text-[10px] text-muted-foreground/50 italic text-center py-2">No date-range SLA rules</p>
      )}
    </div>
  );
}
