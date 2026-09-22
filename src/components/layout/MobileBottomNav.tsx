import { LayoutDashboard, History, Building2, Settings, BarChart2, FileText } from 'lucide-react';
import { UserProfile } from '../../types';

type Tab = 'dashboard' | 'completed' | 'clients' | 'users' | 'settings' | 'analytics' | 'proposals';

interface MobileBottomNavProps {
  sidebarTab: Tab;
  setSidebarTab: (tab: Tab) => void;
  userProfile: UserProfile | null;
  isViewer: boolean;
  isBdm: boolean;
  isUser?: boolean;
}

export function MobileBottomNav({ sidebarTab, setSidebarTab, userProfile, isViewer, isBdm, isUser = false }: MobileBottomNavProps) {
  const isAdmin = userProfile?.role === 'admin';

  const items: { tab: Tab; icon: React.ElementType; label: string }[] = [
    { tab: 'dashboard', icon: LayoutDashboard, label: 'Orders' },
    ...(isBdm || isAdmin || isUser ? [{ tab: 'proposals' as Tab, icon: FileText, label: 'Proposal Budgetary Quotes' }] : []),
    ...(isAdmin ? [{ tab: 'analytics' as Tab, icon: BarChart2, label: 'Analytics' }] : []),
    { tab: 'completed', icon: History, label: 'Completed' },
    ...(!isViewer ? [{ tab: 'clients' as Tab, icon: Building2, label: 'Clients' }] : []),
    { tab: 'settings' as Tab, icon: Settings, label: 'Settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-md border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around px-1 py-2">
        {items.map(({ tab, icon: Icon, label }) => {
          const active = sidebarTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab)}
              className={`flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-all ${active ? 'bg-primary/10' : ''}`}>
                <Icon size={19} />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wide leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
