import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UserProfile } from '../../types';
import { WorkflowStep } from '../../hooks/useSteps';
import { DocumentTriggerPanel } from '../settings/DocumentTriggerPanel';
import { StagnationAlertPanel } from '../settings/StagnationAlertPanel';
import { DateRangeSlaPanel } from '../settings/DateRangeSlaPanel';
import { ThankYouEmailPanel } from '../settings/ThankYouEmailPanel';
import { RequiredAttachmentsPanel } from '../settings/RequiredAttachmentsPanel';
import { Settings2, Plus, GripVertical, Trash2, Check, Users, Pencil } from 'lucide-react';

interface WorkflowSettingsProps {
  userProfile: UserProfile | null;
  steps: WorkflowStep[];
  addStep: (step: Partial<WorkflowStep>) => Promise<void>;
  updateStep: (id: string, step: Partial<WorkflowStep>) => Promise<void>;
  deleteStep: (id: string) => Promise<void>;
  reorderSteps: (orderedIds: string[]) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

const THEMES = [
  { name: 'Slate',  dot: 'bg-slate-400',  value: 'bg-slate-100 text-slate-700 border-slate-200' },
  { name: 'Blue',   dot: 'bg-blue-400',   value: 'bg-blue-100 text-blue-700 border-blue-200' },
  { name: 'Green',  dot: 'bg-green-500',  value: 'bg-green-100 text-green-700 border-green-200' },
  { name: 'Amber',  dot: 'bg-amber-400',  value: 'bg-amber-100 text-amber-700 border-amber-200' },
  { name: 'Red',    dot: 'bg-red-400',    value: 'bg-red-100 text-red-700 border-red-200' },
  { name: 'Purple', dot: 'bg-purple-400', value: 'bg-purple-100 text-purple-700 border-purple-200' },
  { name: 'Pink',   dot: 'bg-pink-400',   value: 'bg-pink-100 text-pink-700 border-pink-200' },
  { name: 'Teal',   dot: 'bg-teal-400',   value: 'bg-teal-100 text-teal-700 border-teal-200' },
];

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {THEMES.map(t => (
        <button
          key={t.name}
          type="button"
          title={t.name}
          onClick={() => onChange(t.value)}
          className={`w-6 h-6 rounded-full ${t.dot} transition-all ${
            value === t.value
              ? 'ring-2 ring-primary ring-offset-2 ring-offset-card scale-110'
              : 'opacity-60 hover:opacity-100 hover:scale-110'
          }`}
        />
      ))}
    </div>
  );
}

export function WorkflowSettings({
  userProfile, steps, addStep, updateStep, deleteStep, reorderSteps, isOpen, onClose,
}: WorkflowSettingsProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [assignments, setAssignments] = useState<Record<string, any[]>>({});
  const [docTriggers, setDocTriggers] = useState<any[]>([]);
  const [customAlerts, setCustomAlerts] = useState<any[]>([]);
  const [dateRangeRules, setDateRangeRules] = useState<any[]>([]);
  const [thankYouConfigs, setThankYouConfigs] = useState<any[]>([]);
  const [stepRequirements, setStepRequirements] = useState<any[]>([]);

  // Inline step editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState(THEMES[0].value);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // New step form
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(THEMES[0].value);

  // Drag-and-drop
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.role !== 'admin' || !isOpen) return;
    const token = localStorage.getItem('token');
    const h = { 'Authorization': `Bearer ${token}` };

    fetch('/api/auth/users', { headers: h }).then(r => r.json()).then(setUsers).catch(console.error);

    fetch('/api/settings/step-assignments', { headers: h })
      .then(r => r.json())
      .then((data: any[]) => {
        const map: Record<string, any[]> = {};
        data.forEach(item => {
          if (!map[item.step]) map[item.step] = [];
          map[item.step].push({
            userId: item.userId,
            notifyOnArrival: item.notifyOnArrival,
            notifyOnSLA: item.notifyOnSLA,
            canAdvance: item.canAdvance !== undefined ? item.canAdvance : true,
          });
        });
        setAssignments(map);
      })
      .catch(console.error);

    fetch('/api/settings/document-triggers', { headers: h }).then(r => r.json()).then(setDocTriggers).catch(console.error);
    fetch('/api/settings/custom-alerts', { headers: h }).then(r => r.json()).then(setCustomAlerts).catch(console.error);
    fetch('/api/settings/date-range-sla-rules', { headers: h }).then(r => r.json()).then(setDateRangeRules).catch(console.error);
    fetch('/api/settings/thank-you-emails', { headers: h }).then(r => r.json()).then(setThankYouConfigs).catch(console.error);
    fetch('/api/settings/step-requirements', { headers: h }).then(r => r.json()).then(setStepRequirements).catch(console.error);
  }, [userProfile, isOpen]);

  const handleAssign = async (step: string, nextAssignments: any[]) => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/settings/step-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ step, assignments: nextAssignments }),
      });
      setAssignments(prev => ({ ...prev, [step]: nextAssignments }));
    } catch {
      toast.error('Failed to update assignment');
    }
  };

  const startEdit = (step: WorkflowStep) => {
    setEditingId(step.id);
    setEditLabel(step.label);
    setEditColor(step.color);
    setDeleteConfirmId(null);
    setIsAdding(false);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    if (!editingId || !editLabel.trim()) { toast.error('Stage name is required'); return; }
    await updateStep(editingId, { label: editLabel.trim(), color: editColor });
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!newLabel.trim()) { toast.error('Stage name is required'); return; }
    const id = newLabel.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (steps.find(s => s.id === id)) { toast.error('A stage with this name already exists'); return; }
    await addStep({ id, label: newLabel.trim(), color: newColor, position: steps.length + 1 });
    setNewLabel('');
    setNewColor(THEMES[0].value);
    setIsAdding(false);
  };

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const from = steps.findIndex(s => s.id === draggedId);
    const to = steps.findIndex(s => s.id === targetId);
    const reordered = [...steps];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    reorderSteps(reordered.map(s => s.id));
    setDraggedId(null);
    setDragOverId(null);
  };

  if (userProfile?.role !== 'admin') return null;

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[700px] rounded-[2.5rem] border border-border bg-card shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500">
              <Settings2 size={24} />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-foreground">Workflow &amp; Notifications</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Configure stages and assign users for alerts. Drag to reorder.</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          {steps.map(step => (
            <div
              key={step.id}
              draggable={editingId !== step.id}
              onDragStart={() => setDraggedId(step.id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(step.id); }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={() => handleDrop(step.id)}
              onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
              className={`rounded-2xl border bg-card transition-all relative overflow-hidden ${
                draggedId === step.id ? 'opacity-40' : ''
              } ${
                dragOverId === step.id && draggedId !== step.id
                  ? 'border-primary shadow-md shadow-primary/10'
                  : 'border-border/50 shadow-sm'
              }`}
            >
              <div className={`absolute left-0 top-0 w-1.5 h-full ${step.color.split(' ')[0]}`} />

              <div className="pl-5 pr-4 py-4">
                {editingId === step.id ? (
                  <div className="space-y-3">
                    <Input
                      autoFocus
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="rounded-xl font-bold text-sm h-9"
                    />
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Color</span>
                      <ColorPicker value={editColor} onChange={setEditColor} />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={saveEdit} className="rounded-lg h-7 px-4 text-xs gap-1.5">
                        <Check size={12} /> Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit} className="rounded-lg h-7 px-3 text-xs">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Step header row */}
                    <div className="flex items-center gap-2">
                      <GripVertical size={14} className="text-muted-foreground/30 cursor-grab shrink-0" />
                      <span className="font-bold text-foreground flex-1">{step.label}</span>

                      <button
                        title={step.canSkip !== false ? 'Step can be skipped — click to make required' : 'Step is required — click to allow skipping'}
                        onClick={() => updateStep(step.id, { canSkip: step.canSkip === false ? true : false })}
                        className={`text-[9px] font-bold px-2 py-1 rounded-lg border transition-all ${
                          step.canSkip === false
                            ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                            : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                        }`}
                      >
                        {step.canSkip === false ? 'Required' : 'Optional'}
                      </button>

                      <button
                        title={step.isExternalTeam ? 'External team step — click to mark internal' : 'Internal step — click to mark as external team'}
                        onClick={() => updateStep(step.id, { isExternalTeam: !step.isExternalTeam })}
                        className={`text-[9px] font-bold px-2 py-1 rounded-lg border transition-all ${
                          step.isExternalTeam
                            ? 'bg-sky-500/10 text-sky-600 border-sky-500/30'
                            : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                        }`}
                      >
                        {step.isExternalTeam ? 'External' : 'Internal'}
                      </button>

                      <button
                        title={step.clientReminderEnabled ? 'Client POP reminders enabled — click to disable' : 'Enable client POP reminders (day 5 warning, day 7 final, day 8 auto-expire)'}
                        onClick={() => updateStep(step.id, { clientReminderEnabled: !step.clientReminderEnabled })}
                        className={`text-[9px] font-bold px-2 py-1 rounded-lg border transition-all ${
                          step.clientReminderEnabled
                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                            : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                        }`}
                      >
                        {step.clientReminderEnabled ? 'Client Remind' : 'No Client Remind'}
                      </button>

                      {deleteConfirmId === step.id ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2">
                          <span className="text-[10px] font-bold text-rose-500 uppercase">Delete?</span>
                          <Button variant="ghost" size="sm"
                            className="h-6 px-2 text-[10px] font-bold text-rose-600 hover:bg-rose-500/10 rounded-lg"
                            onClick={async () => { await deleteStep(step.id); setDeleteConfirmId(null); }}>
                            Yes
                          </Button>
                          <Button variant="ghost" size="sm"
                            className="h-6 px-2 text-[10px] font-bold text-muted-foreground hover:bg-muted rounded-lg"
                            onClick={() => setDeleteConfirmId(null)}>
                            No
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon"
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary"
                            onClick={() => startEdit(step)}>
                            <Pencil size={13} />
                          </Button>
                          <Button variant="ghost" size="icon"
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-rose-500"
                            onClick={() => { setDeleteConfirmId(step.id); cancelEdit(); }}>
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Mailing list */}
                    <div className="bg-muted/20 p-3 rounded-xl border border-border/30 ml-5">
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={12} className="text-muted-foreground" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mailing List</span>
                      </div>
                      <div className="grid gap-2">
                        {users.map(u => {
                          const userAssignment = (assignments[step.id] || []).find(a => a.userId === u.uid);
                          const isAssigned = !!userAssignment;
                          return (
                            <div key={u.uid} className="flex items-center justify-between p-2 rounded-xl border border-border/50 bg-background/50">
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-foreground truncate">{u.displayName || u.email}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    const current = assignments[step.id] || [];
                                    const next = isAssigned
                                      ? current.filter(a => a.userId !== u.uid)
                                      : [...current, { userId: u.uid, notifyOnArrival: true, notifyOnSLA: true, canAdvance: true }];
                                    handleAssign(step.id, next);
                                  }}
                                  className={`text-[9px] font-bold px-2 py-1 rounded-lg border transition-all ${
                                    isAssigned ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                                  }`}
                                >
                                  {isAssigned ? 'Assigned' : 'Assign'}
                                </button>

                                {isAssigned && (
                                  <>
                                    <div className="w-px h-4 bg-border mx-1" />
                                    {[
                                      { key: 'notifyOnArrival', label: 'Arrival', active: userAssignment.notifyOnArrival, colour: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30' },
                                      { key: 'notifyOnSLA',     label: 'SLA',     active: userAssignment.notifyOnSLA,     colour: 'bg-rose-500/10 text-rose-600 border-rose-500/30' },
                                      { key: 'canAdvance',      label: 'Advance', active: userAssignment.canAdvance !== false, colour: 'bg-violet-500/10 text-violet-600 border-violet-500/30' },
                                    ].map(({ key, label, active, colour }) => (
                                      <button
                                        key={key}
                                        onClick={() => {
                                          const current = assignments[step.id] || [];
                                          const next = current.map(a => a.userId === u.uid ? { ...a, [key]: !a[key] } : a);
                                          handleAssign(step.id, next);
                                        }}
                                        className={`text-[9px] font-bold px-2 py-1 rounded-lg border transition-all ${
                                          active ? colour : 'bg-muted text-muted-foreground border-border'
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {users.length === 0 && (
                        <p className="text-[10px] text-muted-foreground/50 italic text-center py-2">No users found</p>
                      )}
                    </div>

                    <DocumentTriggerPanel
                      stepId={step.id}
                      users={users}
                      triggers={docTriggers}
                      onTriggersChange={setDocTriggers}
                    />

                    <StagnationAlertPanel
                      stepId={step.id}
                      users={users}
                      alerts={customAlerts}
                      onAlertsChange={setCustomAlerts}
                    />

                    <DateRangeSlaPanel
                      stepId={step.id}
                      users={users}
                      rules={dateRangeRules}
                      onRulesChange={setDateRangeRules}
                    />

                    <ThankYouEmailPanel
                      stepId={step.id}
                      configs={thankYouConfigs}
                      onConfigsChange={setThankYouConfigs}
                    />

                    <RequiredAttachmentsPanel
                      stepId={step.id}
                      requirements={stepRequirements}
                      onRequirementsChange={setStepRequirements}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}

          {steps.length === 0 && !isAdding && (
            <p className="text-sm text-muted-foreground text-center py-6">No stages defined yet.</p>
          )}

          {isAdding ? (
            <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
              <Input
                autoFocus
                placeholder="Stage name, e.g. Initial Review"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') { setIsAdding(false); setNewLabel(''); }
                }}
                className="rounded-xl font-bold text-sm h-9"
              />
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Color</span>
                <ColorPicker value={newColor} onChange={setNewColor} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleAdd} className="rounded-lg h-7 px-4 text-xs gap-1.5">
                  <Check size={12} /> Add Stage
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={() => { setIsAdding(false); setNewLabel(''); setNewColor(THEMES[0].value); }}
                  className="rounded-lg h-7 px-3 text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setIsAdding(true); setEditingId(null); setDeleteConfirmId(null); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-transparent hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all text-xs font-bold"
            >
              <Plus size={14} /> Add Stage
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
