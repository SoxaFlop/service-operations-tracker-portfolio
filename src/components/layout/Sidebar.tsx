import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LayoutDashboard, History, Users, Building2, Settings, LogOut, BarChart2, FileText } from 'lucide-react';
const logoImg = '/brand-mark.svg';
import { UserProfile } from '../../types';

type Tab = 'dashboard' | 'completed' | 'clients' | 'users' | 'settings' | 'analytics' | 'proposals';

interface SidebarProps {
  sidebarTab: Tab;
  setSidebarTab: (tab: Tab) => void;
  userProfile: UserProfile | null;
  user: any | null;
  handleLogout: () => void;
  isViewer: boolean;
  isBdm: boolean;
  isUser?: boolean;
}

export function Sidebar({ sidebarTab, setSidebarTab, userProfile, user, handleLogout, isViewer, isBdm, isUser = false }: SidebarProps) {
  const navItem = (tab: Tab, label: string, Icon: React.ElementType) => (
    <Button
      variant={sidebarTab === tab ? 'secondary' : 'ghost'}
      className={`w-full justify-start gap-3 rounded-xl ${sidebarTab === tab ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-primary hover:bg-primary/5'}`}
      onClick={() => setSidebarTab(tab)}
    >
      <Icon size={18} />
      {label}
    </Button>
  );

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-sidebar border-r border-border flex-col hidden md:flex z-40">
      <div className="p-6 flex items-center gap-3">
        <img src={logoImg} alt="Service Operations Tracker" className="h-8 w-8 object-contain" />
        <div className="flex flex-col">
          <h1 className="font-bold text-lg leading-tight text-foreground">Service Operations Tracker</h1>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Order Management</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItem('dashboard', 'Order Dashboard', LayoutDashboard)}
        {(isBdm || userProfile?.role === 'admin' || isUser) && navItem('proposals', 'Proposal Budgetary Quotes', FileText)}
        {userProfile?.role === 'admin' && navItem('analytics', 'Analytics', BarChart2)}

        {navItem('completed', 'Order History', History)}
        {!isViewer && navItem('clients', 'Clients', Building2)}
        {userProfile?.role === 'admin' && navItem('users', 'User Management', Users)}

        <Separator className="my-4 opacity-50" />
        {navItem('settings', 'Settings', Settings)}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setSidebarTab('settings')}>
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
            {user?.displayName?.[0] || user?.email?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate text-foreground">{user?.displayName || 'User'}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleLogout(); }}
            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-lg"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
