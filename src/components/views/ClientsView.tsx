import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Client, UserProfile } from '../../types';
import { toast } from 'sonner';
import { Building2, Mail, UserRound, Plus, Pencil, Trash2, ChevronRight, Briefcase } from 'lucide-react';

interface ClientsViewProps {
  clients: Client[];
  isLoading?: boolean;
  userProfile: UserProfile | null;
  createClient: (data: { name: string; contactName: string; email: string; ccEmails?: string; bdmIds?: string[] }) => Promise<boolean>;
  updateClient: (id: string, data: Partial<Client>) => Promise<boolean>;
  deleteClient: (id: string) => Promise<boolean>;
}

interface BdmUser { id: string; displayName: string; email: string; }

const emptyForm = { name: '', contactName: '', email: '', ccEmails: '' };

export function ClientsView({ clients, isLoading = false, userProfile, createClient, updateClient, deleteClient }: ClientsViewProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [createBdmIds, setCreateBdmIds] = useState<string[]>([]);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editBdmIds, setEditBdmIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bdmUsers, setBdmUsers] = useState<BdmUser[]>([]);

  const isAdmin = userProfile?.role === 'admin';
  const isBdm = userProfile?.role === 'bdm';

  useEffect(() => {
    if (!isAdmin) return;
    const token = localStorage.getItem('token');
    fetch('/api/auth/users?assignable=true', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((users: any[]) => setBdmUsers(users.filter((u) => u.role === 'bdm').map((u) => ({ id: u.uid, displayName: u.displayName, email: u.email }))))
      .catch(() => {});
  }, [isAdmin]);

  const openCreate = () => { setForm(emptyForm); setCreateBdmIds([]); setShowCreate(true); };
  const openEdit = (c: Client) => {
    setSelectedClient(c);
    setEditForm({ name: c.name, contactName: c.contactName, email: c.email, ccEmails: c.ccEmails || '' });
    setEditBdmIds(c.bdms?.map(b => b.id) ?? (c.bdmId ? [c.bdmId] : []));
    setShowDeleteConfirm(false);
  };
  const closeEdit = () => { setSelectedClient(null); setShowDeleteConfirm(false); };

  const handleCreate = async () => {
    if (!form.name || !form.email) return;
    setIsSaving(true);
    const ok = await createClient({ ...form, bdmIds: createBdmIds });
    setIsSaving(false);
    if (ok) { setShowCreate(false); setForm(emptyForm); setCreateBdmIds([]); }
  };

  const handleUpdate = async () => {
    if (!selectedClient) return;
    setIsSaving(true);
    const ok = await updateClient(selectedClient.id, { ...editForm, bdmIds: editBdmIds } as any);
    setIsSaving(false);
    if (ok) closeEdit();
  };

  const handleDelete = async () => {
    if (!selectedClient) return;
    setIsSaving(true);
    const ok = await deleteClient(selectedClient.id);
    setIsSaving(false);
    if (ok) closeEdit();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Clients</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your client directory and link them to orders.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-primary/10 text-primary border-primary/20 rounded-full px-3 py-1">
            {clients.length} {clients.length === 1 ? 'Client' : 'Clients'}
          </Badge>
          {!isBdm && (
            <Button onClick={openCreate} className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl h-9 gap-1.5 shadow-md shadow-indigo-500/20">
              <Plus size={16} /> New Client
            </Button>
          )}
        </div>
      </div>

      {/* Client list */}
      <div className="grid gap-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center p-4 gap-4 rounded-2xl bg-card border border-border/30 animate-pulse">
              <div className="w-11 h-11 rounded-2xl bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-muted rounded-lg w-1/3" />
                <div className="h-3 bg-muted/60 rounded-lg w-1/2" />
              </div>
              <div className="w-4 h-4 bg-muted rounded-full shrink-0" />
            </div>
          ))
        ) : (
          <>
            {clients.map((c) => (
              <Card key={c.id} onClick={() => !isBdm && openEdit(c)}
                className={`border-none shadow-sm rounded-2xl overflow-hidden bg-card border border-border/50 transition-all duration-200 group ${!isBdm ? 'cursor-pointer hover:shadow-md hover:border-primary/20' : ''}`}>
                <div className="flex items-center p-4 gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground truncate group-hover:text-primary transition-colors">{c.name}</h3>
                    <div className="flex items-center gap-3 mt-0.5">
                      {c.contactName && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <UserRound size={11} /> {c.contactName}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail size={11} /> {c.email}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(c.bdms ?? (c.bdm ? [c.bdm] : [])).slice(0, 3).map(b => (
                      <Badge key={b.id} className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 text-[10px] font-bold gap-1">
                        <Briefcase size={10} /> {b.displayName}
                      </Badge>
                    ))}
                    <ChevronRight size={16} className="text-muted-foreground/30 group-hover:text-primary/40 transition-colors" />
                  </div>
                </div>
              </Card>
            ))}

            {clients.length === 0 && (
              <div className="text-center py-16 bg-muted/10 rounded-[2rem] border border-dashed border-border">
                <Building2 size={40} className="mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground text-sm font-medium mb-4">No clients yet.</p>
                {!isBdm && (
                  <Button onClick={openCreate} variant="outline" className="rounded-xl gap-2">
                    <Plus size={14} /> Add First Client
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Create Dialog ───────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) setShowCreate(false); }}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">New Client</DialogTitle>
            <DialogDescription>Add a company to your client directory.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Company Name <span className="text-rose-400">*</span></Label>
              <Input className="rounded-xl bg-muted/30 border-border" placeholder="e.g. Greenfields Academy"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Contact Person</Label>
              <Input className="rounded-xl bg-muted/30 border-border" placeholder="e.g. Jane Doe"
                value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Email Address <span className="text-rose-400">*</span></Label>
              <Input type="email" className="rounded-xl bg-muted/30 border-border" placeholder="billing@company.co.za"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase">CC Emails</Label>
              <Input className="rounded-xl bg-muted/30 border-border" placeholder="Separated by commas"
                value={form.ccEmails} onChange={(e) => setForm({ ...form, ccEmails: e.target.value })} />
            </div>
            {isAdmin && bdmUsers.length > 0 && (
              <div className="grid gap-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Assigned Account Managers</Label>
                <div className="space-y-0.5 max-h-44 overflow-y-auto rounded-xl border border-border bg-muted/30 p-1.5">
                  {bdmUsers.map(u => (
                    <label key={u.id}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/60 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={createBdmIds.includes(u.id)}
                        onChange={() => setCreateBdmIds(prev =>
                          prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                        )}
                        className="rounded"
                      />
                      <Briefcase size={11} className="text-teal-500 shrink-0" />
                      <span className="text-sm flex-1 truncate">{u.displayName}</span>
                      <span className="text-[10px] text-muted-foreground">{u.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving || !form.name || !form.email}
              className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl px-6">
              {isSaving ? 'Creating...' : 'Create Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit/Delete Dialog ──────────────────────────── */}
      <Dialog open={!!selectedClient} onOpenChange={(o) => { if (!o) closeEdit(); }}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
          {selectedClient && (
            <>
              <div className="p-7 pb-4 bg-slate-50/60 border-b border-slate-100 dark:bg-muted/20 dark:border-border">
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-bold">{selectedClient.name}</DialogTitle>
                      <DialogDescription className="text-xs">{selectedClient.email}</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="p-7 space-y-4">
                <div className="grid gap-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">Company Name</Label>
                  <Input className="rounded-xl bg-muted/30 border-border" value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">Contact Person</Label>
                  <Input className="rounded-xl bg-muted/30 border-border" value={editForm.contactName}
                    onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">Email Address</Label>
                  <Input type="email" className="rounded-xl bg-muted/30 border-border" value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">CC Emails</Label>
                  <Input className="rounded-xl bg-muted/30 border-border" placeholder="Separated by commas" value={editForm.ccEmails}
                    onChange={(e) => setEditForm({ ...editForm, ccEmails: e.target.value })} />
                </div>

                {/* Account Manager assignment — admin only */}
                {isAdmin && (
                  <div className="grid gap-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Assigned Account Managers</Label>
                    {bdmUsers.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1">No Account Manager accounts found.</p>
                    ) : (
                      <div className="space-y-0.5 max-h-44 overflow-y-auto rounded-xl border border-border bg-muted/30 p-1.5">
                        {bdmUsers.map(u => (
                          <label key={u.id}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/60 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={editBdmIds.includes(u.id)}
                              onChange={() => setEditBdmIds(prev =>
                                prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                              )}
                              className="rounded"
                            />
                            <Briefcase size={11} className="text-teal-500 shrink-0" />
                            <span className="text-sm flex-1 truncate">{u.displayName}</span>
                            <span className="text-[10px] text-muted-foreground">{u.email}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Delete — admin only */}
                {isAdmin && (
                  <div className="pt-2 border-t border-border/50">
                    {showDeleteConfirm ? (
                      <div className="flex items-center gap-3 bg-red-500/10 rounded-xl p-3 animate-in fade-in">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-red-600">Remove this client?</p>
                          <p className="text-[10px] text-red-400">Existing orders will be unlinked, not deleted.</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold rounded-lg"
                            onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                          <Button size="sm" className="h-7 text-[10px] font-bold rounded-lg bg-red-500 hover:bg-red-600 text-white"
                            onClick={handleDelete} disabled={isSaving}>
                            {isSaving ? '...' : 'Confirm'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="ghost" className="w-full justify-start text-red-500/70 hover:text-red-600 hover:bg-red-500/10 rounded-xl gap-2 h-9 text-sm font-bold"
                        onClick={() => setShowDeleteConfirm(true)}>
                        <Trash2 size={14} /> Remove Client
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="px-7 pb-7 flex gap-3 justify-end">
                <Button variant="ghost" onClick={closeEdit} className="rounded-xl">Cancel</Button>
                <Button onClick={handleUpdate} disabled={isSaving}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 gap-1.5">
                  <Pencil size={13} />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
