import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, TrendingUp, Zap } from 'lucide-react';
const logoImg = '/brand-mark.svg';
import { Order } from '../../types';
import { toast } from 'sonner';

interface DashboardStatsProps {
  orders: Order[];
  activeOrders: Order[];
  completedOrders: Order[];
  formatCurrency: (amount?: number) => string;
}

const TERMINAL_STATUSES = ['quote_expired', 'quote_rejected'];

const orderValue = (o: Order) => {
  const productsTotal = (o.products || []).reduce((s, p) => s + (p.lineTotal || 0), 0);
  return o.quoteAmount || productsTotal || 0;
};

const techOrderValue = (o: Order) => {
  if (o.products && o.products.length > 0) {
    return o.products.reduce((s, p) => {
      const pCategory = p.category || o.category;
      return pCategory === 'tech_product' ? s + (p.lineTotal || 0) : s;
    }, 0);
  }
  return o.category === 'tech_product' ? (o.quoteAmount || 0) : 0;
};

export function DashboardStats({ orders, activeOrders, completedOrders, formatCurrency }: DashboardStatsProps) {
  const handleDeltaClick = () => {
    const total = orders.length;
    const active = activeOrders.length;
    const completed = completedOrders.length;

    toast.info(`Process Delta: ${active} Active, ${completed} Completed out of ${total} total.`, {
      icon: <img src={logoImg} alt="Service Operations" className="w-4 h-4 rounded-sm" />
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="border-none shadow-sm rounded-[2rem] p-6 bg-primary text-primary-foreground relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
          <Package size={80} />
        </div>
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Active Orders</p>
          <h3 className="text-4xl font-black">{activeOrders.length}</h3>
          <div className="mt-4 flex items-center gap-2">
            <Badge className="bg-primary-foreground/20 text-primary-foreground border-none text-[10px] font-bold">LIVE TRACKING</Badge>
          </div>
        </div>
      </Card>

      <Card className="border-none shadow-sm rounded-[2rem] p-6 bg-card border border-border relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 text-primary/5 group-hover:scale-110 transition-transform">
          <TrendingUp size={80} />
        </div>
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Revenue</p>
          <h3 className="text-4xl font-black text-foreground">{formatCurrency(completedOrders.filter(o => !TERMINAL_STATUSES.includes(o.status)).reduce((sum, o) => sum + techOrderValue(o), 0))}</h3>
          <div className="mt-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tech services revenue</span>
          </div>
        </div>
      </Card>

      <Card className="border-none shadow-sm rounded-[2rem] p-6 bg-card border border-border relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 text-secondary/5 group-hover:scale-110 transition-transform">
          <Zap size={80} />
        </div>
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Process Delta</p>
          <h3 className="text-4xl font-black text-foreground">{Math.round((completedOrders.length / (orders.length || 1)) * 100)}%</h3>
          <Button
            variant="default"
            size="sm"
            className="mt-4 h-8 px-4 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-sm"
            onClick={handleDeltaClick}
          >
            View Efficiency
          </Button>
        </div>
      </Card>
    </div>
  );
}
