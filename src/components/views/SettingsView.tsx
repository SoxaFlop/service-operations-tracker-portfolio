import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Palette, Bell, Shield, ExternalLink, CheckCircle2, AlertCircle, Key, Download, Sun, Sparkles, Moon, Check } from 'lucide-react';
import { UserProfile, Order } from '../../types';
import { toast } from 'sonner';
import { WorkflowSettings } from './WorkflowSettings';
import { WorkflowStep } from '../../hooks/useSteps';
import type { AppTheme } from '../../hooks/useTheme';

interface SettingsViewProps {
  userProfile: UserProfile | null;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  handleLogout: () => void;
  orders: Order[];
  completedOrders: Order[];
  steps: WorkflowStep[];
  addStep: (step: Partial<WorkflowStep>) => Promise<void>;
  updateStep: (id: string, step: Partial<WorkflowStep>) => Promise<void>;
  deleteStep: (id: string) => Promise<void>;
  reorderSteps: (orderedIds: string[]) => Promise<void>;
  onSetPassword: (password: string) => Promise<boolean>;
}

export function SettingsView({
  userProfile, theme, setTheme, handleLogout, orders, completedOrders, steps,
  addStep, updateStep, deleteStep, reorderSteps,
  onSetPassword
}: SettingsViewProps) {
  const role = userProfile?.role ?? 'viewer';
  const isAdmin = role === 'admin';
  const isViewer = role === 'viewer';
  const isBdm = role === 'bdm';

  const [isSecurityDialogOpen, setIsSecurityDialogOpen] = useState(false);
  const [isWorkflowSettingsOpen, setIsWorkflowSettingsOpen] = useState(false);

  // Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsPasswordLoading(true);
    const success = await onSetPassword(newPassword);
    if (success) {
      setNewPassword('');
      setConfirmPassword('');
    }
    setIsPasswordLoading(false);
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(orders, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `service_operations_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    toast.success('Data exported successfully');
  };

  const handleDownloadOrderHistory = () => {
    const statusLabel = (status: string) =>
      status === 'quote_expired' ? 'No POP — Quote Expired'
        : status === 'quote_rejected' ? 'Quote Declined'
          : 'Completed';

    const rows = [
      ['Order ID', 'Client', 'Status', 'Category', 'Products', 'Value', 'Date'].join(','),
      ...completedOrders.map(o => {
        const value = o.quoteAmount || (o.products || []).reduce((s, p) => s + (p.lineTotal || 0), 0);
        const products = o.products && o.products.length > 0
          ? o.products.map(p => p.name).join('; ')
          : o.licenseType || '';
        return [
          o.id,
          `"${(o.clientName || '').replace(/"/g, '""')}"`,
          statusLabel(o.status),
          o.category === 'device_management' ? 'Device Management' : o.category === 'sales' ? 'Sales' : o.category === 'training' ? 'Training' : 'Tech Services',
          `"${products.replace(/"/g, '""')}"`,
          value.toFixed(2),
          new Date(o.updatedAt).toLocaleDateString(),
        ].join(',');
      }),
    ].join('\n');

    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `order_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Order history downloaded');
  };

  const handleRevokeSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/revoke-sessions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('token', data.token); // Store the shiny new token
      toast.success(data.message);
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke sessions');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold text-foreground">Settings</h2>

      <div className="grid gap-6">
        {/* User Profile Section */}
        <Card className="border-none shadow-sm rounded-[2rem] p-8 space-y-6 bg-card border border-border/50">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-[2rem] bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl overflow-hidden shadow-lg shadow-primary/10">
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt={userProfile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                userProfile?.displayName?.[0] || userProfile?.email?.[0] || 'U'
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold text-foreground">{userProfile?.displayName || 'User Profile'}</h3>
                <Badge className="bg-primary/10 text-primary border-primary/20 rounded-full text-[10px]">
                  {userProfile?.role.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{userProfile?.email}</p>
              {userProfile?.createdAt && (
                <p className="text-[10px] text-muted-foreground font-bold uppercase mt-2">Member since {new Date(userProfile.createdAt).toLocaleDateString()}</p>
              )}
            </div>
            <Button variant="outline" className="rounded-xl border-border" onClick={handleLogout}>
              Sign Out
            </Button>
          </div>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] p-6 space-y-6 bg-card border border-border/50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Palette size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground">Appearance</h3>
              <p className="text-xs text-muted-foreground">Customize the look and feel of your tracker.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Appearance theme">
            {([
              {
                value: 'pastel' as const,
                label: 'Pastel Light',
                description: 'The original bright theme',
                icon: Sun,
                preview: (
                  <div className="h-20 rounded-xl border border-slate-200 bg-slate-50 p-2.5" aria-hidden="true">
                    <div className="flex h-full gap-2">
                      <div className="w-4 rounded-md bg-white shadow-sm" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-2 w-2/3 rounded-full bg-slate-800" />
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="h-8 rounded-md bg-white shadow-sm" />
                          <div className="h-8 rounded-md bg-white shadow-sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                value: 'modern' as const,
                label: 'Modern',
                description: 'Fresh, polished and focused',
                icon: Sparkles,
                preview: (
                  <div className="h-20 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-2.5" aria-hidden="true">
                    <div className="flex h-full gap-2">
                      <div className="w-4 rounded-md bg-blue-600 shadow-sm shadow-blue-300" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-2 w-2/3 rounded-full bg-slate-700" />
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="h-8 rounded-md border border-white bg-white/90 shadow-sm" />
                          <div className="h-8 rounded-md bg-blue-100 shadow-sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                value: 'dark' as const,
                label: 'Dark Mode',
                description: 'Comfortable in low light',
                icon: Moon,
                preview: (
                  <div className="h-20 rounded-xl border border-slate-700 bg-slate-950 p-2.5" aria-hidden="true">
                    <div className="flex h-full gap-2">
                      <div className="w-4 rounded-md bg-indigo-500" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-2 w-2/3 rounded-full bg-slate-200" />
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="h-8 rounded-md bg-slate-800" />
                          <div className="h-8 rounded-md bg-slate-800" />
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              },
            ]).map((option) => {
              const Icon = option.icon;
              const isSelected = theme === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setTheme(option.value)}
                  className={`relative rounded-2xl border p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                      : 'border-border/70 bg-background/50 hover:border-primary/40 hover:bg-muted/30'
                  }`}
                >
                  {option.preview}
                  <div className="flex items-start gap-2 px-1 pb-1 pt-3">
                    <Icon className={`mt-0.5 size-4 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground">{option.label}</span>
                        {isSelected && (
                          <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check size={10} strokeWidth={3} />
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {isAdmin && (
            <>
              <Separator className="opacity-50" />
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500">
                  <Bell size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-foreground">Notifications</h3>
                  <p className="text-xs text-muted-foreground">Manage email alerts for assignees.</p>
                </div>
                <Button
                  variant="outline"
                  className="rounded-xl border-border text-xs font-bold"
                  onClick={() => setIsWorkflowSettingsOpen(true)}
                >
                  Configure
                </Button>
              </div>
            </>
          )}

          <Separator className="opacity-50" />

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
              <Shield size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground">Security</h3>
              <p className="text-xs text-muted-foreground">Access control and user permissions.</p>
            </div>
            <Button
              variant="outline"
              className="rounded-xl border-border text-xs font-bold"
              onClick={() => setIsSecurityDialogOpen(true)}
            >
              Manage
            </Button>
          </div>
        </Card>

        {userProfile?.role === 'admin' && (
          <WorkflowSettings
            userProfile={userProfile}
            steps={steps}
            addStep={addStep}
            updateStep={updateStep}
            deleteStep={deleteStep}
            reorderSteps={reorderSteps}
            isOpen={isWorkflowSettingsOpen}
            onClose={() => setIsWorkflowSettingsOpen(false)}
          />
        )}

        {isAdmin && <Card className="border-none shadow-sm rounded-[2rem] p-6 bg-slate-900 text-white">
          <h3 className="font-bold mb-2">Data Management</h3>
          <p className="text-xs text-slate-400 mb-6">Export your order data to a JSON file for backup or external analysis.</p>
          <div className="flex gap-3 flex-wrap">
            <Button
              className="bg-white/10 hover:bg-white/15 text-white rounded-xl px-6 font-bold text-xs"
              onClick={handleExportData}
            >
              Export Orders (JSON)
            </Button>
            <Button
              className="bg-white/10 hover:bg-white/15 text-white rounded-xl px-6 font-bold text-xs gap-2"
              onClick={handleDownloadOrderHistory}
            >
              <Download size={13} /> Download Order History (CSV)
            </Button>
          </div>
        </Card>}
      </div>

      <Dialog open={isSecurityDialogOpen} onOpenChange={setIsSecurityDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[2.5rem] border border-border bg-card shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-foreground">Security & Access</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Review your system authorization and permissions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-6">
              <div className="flex items-center justify-between p-5 bg-primary/10 rounded-3xl border border-primary/20">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-card rounded-2xl flex items-center justify-center text-primary shadow-sm">
                    <Shield size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Current Role</p>
                    <p className="text-base font-bold text-foreground">
                      {role === 'admin' ? 'System Administrator'
                        : role === 'user' ? 'Power User'
                        : role === 'bdm' ? 'Business Development Manager'
                        : role === 'viewer' ? 'Read-Only Viewer'
                        : 'Ops User'}
                    </p>
                  </div>
                </div>
                <Badge className="bg-primary text-primary-foreground border-none rounded-full px-3">
                  {role === 'ops' ? 'OPS' : role === 'user' ? 'USER' : role.toUpperCase()}
                </Badge>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-1">Your Permissions</h4>
                <div className="grid gap-2">
                  {[
                    { label: 'View Dashboard & Orders', allowed: true },
                    { label: 'Create & Delete Orders', allowed: isAdmin || role === 'user' },
                    { label: 'Add Documents & Advance Steps', allowed: isAdmin || role === 'user' || role === 'ops' },
                    { label: 'Create & Manage Proposal Budgetary Quotes', allowed: isAdmin || role === 'user' || isBdm },
                    { label: 'Access User Management', allowed: isAdmin },
                    { label: 'Modify System Settings', allowed: isAdmin },
                  ].map((perm) => (
                    <div key={perm.label} className="flex items-center justify-between px-4 py-3 rounded-2xl bg-muted/30 border border-border/50 shadow-sm">
                      <span className="text-xs font-bold text-foreground/80">{perm.label}</span>
                      {perm.allowed ? (
                        <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500">
                          <CheckCircle2 size={12} />
                        </div>
                      ) : (
                        <div className="w-5 h-5 bg-muted rounded-full flex items-center justify-center text-muted-foreground/30">
                          <AlertCircle size={12} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-slate-900 rounded-3xl text-white space-y-6">
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                      <Key size={16} />
                    </div>
                    <h4 className="text-sm font-bold">Personal Security</h4>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
                    Set a password to skip the email codes. This is faster and keeps your account secure.
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[9px] font-bold text-slate-500 uppercase ml-1">New Password</Label>
                      <Input
                        type="password"
                        placeholder="Minimum 6 characters"
                        className="h-10 bg-slate-800 border-slate-700 text-sm rounded-xl focus:ring-1 focus:ring-indigo-500"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Confirm Password</Label>
                      <Input
                        type="password"
                        placeholder="Confirm your password"
                        className="h-10 bg-slate-800 border-slate-700 text-sm rounded-xl focus:ring-1 focus:ring-indigo-500"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isPasswordLoading || !newPassword}
                      className="w-full bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl h-10 mt-2 font-bold text-xs transition-all shadow-lg shadow-indigo-900/40"
                    >
                      {isPasswordLoading ? 'Saving...' : 'Set New Password'}
                    </Button>
                  </div>
                </form>

                <div className="pt-4 border-t border-slate-800">
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2">Active Sessions</p>
                  <div className="flex flex-col gap-3">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Used your account on a public device? Disconnect all other sessions immediately.
                    </p>
                    <Button
                      variant="destructive" size="sm"
                      className="w-full font-bold tracking-wide rounded-xl shadow-lg shadow-rose-900/50 h-9 text-[10px]"
                      onClick={handleRevokeSessions}
                    >
                      Disconnect Other Devices
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 pt-0">
            <Button
              onClick={() => setIsSecurityDialogOpen(false)}
              className="w-full bg-muted hover:bg-muted/80 text-foreground rounded-2xl h-12 font-bold transition-all mt-4"
            >
              Close Overview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
