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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserProfile } from '../../types';
import { toast } from 'sonner';
import { Users, ShieldCheck, Trash2, Pencil, ChevronRight, ShieldOff, Eye, Briefcase } from 'lucide-react';

interface UsersViewProps {
  isAuthReady: boolean;
  userProfile: UserProfile | null;
}

export function UsersView({ isAuthReady, userProfile }: UsersViewProps) {
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user' | 'ops' | 'viewer' | 'bdm'>('ops');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [showAddUser, setShowAddUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user' | 'ops' | 'viewer' | 'bdm'>('ops');

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) setAllUsers(await response.json());
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthReady || userProfile?.role !== 'admin') return;
    fetchUsers();
  }, [isAuthReady, userProfile]);

  const openUser = (u: UserProfile) => {
    setSelectedUser(u);
    setEditName(u.displayName || '');
    setEditRole(u.role as 'admin' | 'user' | 'ops' | 'viewer' | 'bdm');
    setShowDeleteConfirm(false);
  };

  const closeDialog = () => {
    setSelectedUser(null);
    setShowDeleteConfirm(false);
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/auth/users/${selectedUser.uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ role: editRole, displayName: editName }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to update user');
      } else {
        toast.success('User updated successfully');
        await fetchUsers();
        closeDialog();
      }
    } catch {
      toast.error('Failed to update user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/auth/users/${selectedUser.uid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to delete user');
      } else {
        toast.success('User deleted');
        await fetchUsers();
        closeDialog();
      }
    } catch {
      toast.error('Failed to delete user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddUser = async () => {
    if (!newEmail || !newDisplayName) {
      toast.error('Email and Display Name are required');
      return;
    }
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail, displayName: newDisplayName, role: newRole }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to create user');
      } else {
        toast.success('User created successfully');
        await fetchUsers();
        setShowAddUser(false);
        setNewEmail('');
        setNewDisplayName('');
        setNewRole('ops');
      }
    } catch {
      toast.error('Failed to create user');
    } finally {
      setIsSaving(false);
    }
  };

  const isSelf = selectedUser?.uid === userProfile?.uid;
  const adminCount = allUsers.filter(u => u.role === 'admin').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">User Management</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Click a user to edit their role or remove access.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddUser(true)} className="bg-primary/10 text-primary border-primary/20 rounded-full px-4 h-8 text-xs font-bold hover:bg-primary hover:text-white transition-all">
            + Create User
          </Button>
          <Badge className="bg-primary/10 text-primary border-primary/20 rounded-full px-3 py-1">
            {allUsers.length} {allUsers.length === 1 ? 'User' : 'Users'}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center p-4 gap-4 rounded-2xl bg-card border border-border/30 animate-pulse">
              <div className="w-11 h-11 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-muted rounded-lg w-1/4" />
                <div className="h-3 bg-muted/60 rounded-lg w-2/5" />
              </div>
              <div className="w-14 h-5 bg-muted rounded-full shrink-0" />
            </div>
          ))
        ) : (
          <>
            {allUsers.map((u) => (
          <Card
            key={u.uid}
            onClick={() => openUser(u)}
            className="border-none shadow-sm rounded-2xl overflow-hidden bg-card border border-border/50 cursor-pointer hover:shadow-md hover:border-primary/20 transition-all duration-200 group"
          >
            <div className="flex items-center p-4 gap-4">
              {/* Avatar */}
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0 overflow-hidden">
                {u.photoURL ? (
                  <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span>{(u.displayName?.[0] || u.email?.[0] || 'U').toUpperCase()}</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
                    {u.displayName || 'Unnamed User'}
                  </h3>
                  {u.uid === userProfile?.uid && (
                    <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest bg-primary/5 px-1.5 py-0.5 rounded-md">You</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>

              {/* Role + chevron */}
              <div className="flex items-center gap-3 shrink-0">
                <Badge className={`text-[10px] font-bold border gap-1 ${
                  u.role === 'admin'  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' :
                  u.role === 'user'   ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' :
                  u.role === 'viewer' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                  u.role === 'bdm'    ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' :
                                       'bg-muted text-muted-foreground border-border'
                }`}>
                  {u.role === 'admin' ? <ShieldCheck size={10} /> : u.role === 'user' ? <ShieldCheck size={10} /> : u.role === 'viewer' ? <Eye size={10} /> : u.role === 'bdm' ? <Briefcase size={10} /> : <Users size={10} />}
                  {u.role === 'ops' ? 'OPS' : u.role === 'user' ? 'POWER USER' : u.role.toUpperCase()}
                </Badge>
                <p className="text-[10px] text-muted-foreground/60 font-bold uppercase hidden sm:block">
                  {new Date(u.lastLogin).toLocaleDateString()}
                </p>
                <ChevronRight size={16} className="text-muted-foreground/30 group-hover:text-primary/40 transition-colors" />
              </div>
            </div>
          </Card>
        ))}

        {allUsers.length === 0 && (
          <div className="text-center py-16 bg-muted/10 rounded-[2rem] border border-dashed border-border">
            <Users size={40} className="mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground text-sm font-medium">No users found.</p>
          </div>
        )}
          </>
        )}
      </div>

      {/* ── User Edit Dialog ───────────────────────────────── */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-[420px] rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
          {selectedUser && (
            <>
              {/* Header */}
              <div className="p-7 pb-5 bg-muted/40 border-b border-border">
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0 overflow-hidden">
                      {selectedUser.photoURL ? (
                        <img src={selectedUser.photoURL} alt={selectedUser.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span>{(selectedUser.displayName?.[0] || selectedUser.email?.[0] || 'U').toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <DialogTitle className="text-lg font-bold text-foreground truncate">
                        {selectedUser.displayName || 'Unnamed User'}
                      </DialogTitle>
                      <DialogDescription className="text-xs truncate">{selectedUser.email}</DialogDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                    <span>Last active: {new Date(selectedUser.lastLogin).toLocaleDateString()}</span>
                    {isSelf && <Badge className="bg-primary/10 text-primary border-none text-[9px]">This is you</Badge>}
                  </div>
                </DialogHeader>
              </div>

              {/* Body */}
              <div className="p-7 space-y-5">
                {/* Display name */}
                <div className="grid gap-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Display Name</Label>
                  <Input
                    className="rounded-xl border-border bg-muted/30"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Full name"
                    disabled={isSelf}
                  />
                </div>

                {/* Role */}
                <div className="grid gap-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Role & Access</Label>
                  <Select
                    value={editRole}
                    onValueChange={(v) => setEditRole(v as 'admin' | 'user' | 'ops' | 'viewer' | 'bdm')}
                    disabled={isSelf}
                  >
                    <SelectTrigger className="rounded-xl border-border bg-muted/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border min-w-[300px]">
                      <SelectItem value="viewer">
                        <div className="flex items-center gap-2">
                          <Eye size={14} className="text-amber-500 shrink-0" />
                          <div>
                            <p className="font-bold">Viewer</p>
                            <p className="text-[10px] text-muted-foreground whitespace-normal">Read-only: dashboard & completed orders</p>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="ops">
                        <div className="flex items-center gap-2">
                          <ShieldOff size={14} className="text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-bold">Ops</p>
                            <p className="text-[10px] text-muted-foreground whitespace-normal">Operations: add documents and advance steps</p>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="user">
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={14} className="text-violet-500 shrink-0" />
                          <div>
                            <p className="font-bold">Power User</p>
                            <p className="text-[10px] text-muted-foreground whitespace-normal">Full orders & proposal budgetary quotes — no user management</p>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="bdm">
                        <div className="flex items-center gap-2">
                          <Briefcase size={14} className="text-teal-500 shrink-0" />
                          <div>
                            <p className="font-bold">Account Manager</p>
                            <p className="text-[10px] text-muted-foreground whitespace-normal">Business Development: proposal budgetary quotes</p>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={14} className="text-indigo-500 shrink-0" />
                          <div>
                            <p className="font-bold">Admin</p>
                            <p className="text-[10px] text-muted-foreground whitespace-normal">Full access, including user management</p>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {isSelf && (
                    <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">You cannot edit your own role.</p>
                  )}
                </div>

                {/* Delete section */}
                {!isSelf && (
                  <div className="pt-3 border-t border-border/50">
                    {showDeleteConfirm ? (
                      <div className="flex items-center gap-3 bg-red-500/10 rounded-xl p-3 animate-in fade-in slide-in-from-bottom-1">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-red-600">Delete this user?</p>
                          <p className="text-[10px] text-red-400">This will also remove all their orders. This cannot be undone.</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold rounded-lg text-muted-foreground"
                            onClick={() => setShowDeleteConfirm(false)}>
                            Cancel
                          </Button>
                          <Button size="sm" className="h-7 text-[10px] font-bold rounded-lg bg-red-500 hover:bg-red-600 text-white"
                            onClick={handleDelete} disabled={isSaving}>
                            {isSaving ? 'Deleting...' : 'Confirm Delete'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="ghost" className="w-full justify-start text-red-500/80 hover:text-red-600 hover:bg-red-500/10 rounded-xl gap-2 h-9 text-sm font-bold"
                        onClick={() => setShowDeleteConfirm(true)}>
                        <Trash2 size={15} />
                        Remove User Access
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-7 pb-7 flex gap-3 justify-end">
                <Button variant="ghost" onClick={closeDialog} className="rounded-xl">Cancel</Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || isSelf}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 gap-1.5"
                >
                  <Pencil size={13} />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add User Dialog ───────────────────────────────── */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="sm:max-w-[420px] rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
          <div className="p-7 pb-5 bg-muted/40 border-b border-border">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground truncate">
                Create New User
              </DialogTitle>
              <DialogDescription className="text-xs">
                Add a new user to the system. They will log in using OTP.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-7 space-y-5">
            <div className="grid gap-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Address</Label>
              <Input
                className="rounded-xl border-border bg-muted/30"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@company.com"
                type="email"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Display Name</Label>
              <Input
                className="rounded-xl border-border bg-muted/30"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="Full name"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Role & Access</Label>
              <Select
                value={newRole}
                onValueChange={(v) => setNewRole(v as 'admin' | 'user' | 'ops' | 'viewer' | 'bdm')}
              >
                <SelectTrigger className="rounded-xl border-border bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border min-w-[300px]">
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-2">
                      <Eye size={14} className="text-amber-500 shrink-0" />
                      <div>
                        <p className="font-bold">Viewer</p>
                        <p className="text-[10px] text-muted-foreground whitespace-normal">Read-only: dashboard & completed orders</p>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="ops">
                    <div className="flex items-center gap-2">
                      <ShieldOff size={14} className="text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-bold">Ops</p>
                        <p className="text-[10px] text-muted-foreground whitespace-normal">Operations: add documents and advance steps</p>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-violet-500 shrink-0" />
                      <div>
                        <p className="font-bold">Power User</p>
                        <p className="text-[10px] text-muted-foreground whitespace-normal">Full orders & proposal budgetary quotes — no user management</p>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="bdm">
                    <div className="flex items-center gap-2">
                      <Briefcase size={14} className="text-teal-500 shrink-0" />
                      <div>
                        <p className="font-bold">Account Manager</p>
                        <p className="text-[10px] text-muted-foreground whitespace-normal">Business Development: proposal budgetary quotes</p>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-indigo-500 shrink-0" />
                      <div>
                        <p className="font-bold">Admin</p>
                        <p className="text-[10px] text-muted-foreground whitespace-normal">Full access, including user management</p>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="px-7 pb-7 flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setShowAddUser(false)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={handleAddUser}
              disabled={isSaving || !newEmail || !newDisplayName}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6"
            >
              {isSaving ? 'Saving...' : 'Create User'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
