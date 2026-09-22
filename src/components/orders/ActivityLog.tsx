import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import { WorkflowStep } from '../../hooks/useSteps';
import { calculateBusinessDays } from '@/lib/utils';

const formatDateTime = (date: Date) => format(date, 'd MMM yyyy, HH:mm');

interface ActivityLogProps {
  audits: any[];
  steps: WorkflowStep[];
}

export function ActivityLog({ audits, steps }: ActivityLogProps) {
  return (
    <section className="space-y-4">
      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
        <History className="h-3.5 w-3.5" />
        Activity Log
      </h4>
      <div className="bg-slate-50/50 dark:bg-muted/10 rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border/50">
                <th className="px-4 py-2 font-bold text-[10px] uppercase tracking-widest text-slate-500">Stage</th>
                <th className="px-4 py-2 font-bold text-[10px] uppercase tracking-widest text-slate-500">Started</th>
                <th className="px-4 py-2 font-bold text-[10px] uppercase tracking-widest text-slate-500">Completed</th>
                <th className="px-4 py-2 font-bold text-[10px] uppercase tracking-widest text-slate-500">Moved By</th>
                <th className="px-4 py-2 font-bold text-[10px] uppercase tracking-widest text-slate-500 text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {(audits || []).map((audit) => {
                const start = new Date(audit.startedAt);
                const end = audit.completedAt ? new Date(audit.completedAt) : new Date();
                const diffDays = Math.ceil(calculateBusinessDays(start, end));
                const stepName = steps.find(s => s.id === audit.step)?.label || audit.step;
                const isOver5Days = diffDays > 5 && audit.step.toLowerCase().includes('invoice');

                return (
                  <tr key={audit.id} className={`border-b border-border/30 last:border-0 ${isOver5Days ? 'bg-rose-50/50 dark:bg-rose-500/10' : ''}`}>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {stepName}
                      {!audit.completedAt && (
                        <Badge variant="outline" className="ml-2 text-[8px] font-bold text-indigo-400 border-indigo-100 rounded-full h-4">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDateTime(start)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{audit.completedAt ? formatDateTime(new Date(audit.completedAt)) : '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{audit.movedByName ?? '—'}</td>
                    <td className={`px-4 py-3 text-right font-bold ${isOver5Days ? 'text-rose-500' : 'text-slate-500'}`}>
                      {diffDays} {diffDays === 1 ? 'day' : 'days'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
