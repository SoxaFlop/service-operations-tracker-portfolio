import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NewOrderDialog } from '../orders/NewOrderDialog';
import { Order, Client } from '../../types';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  activeCategory: 'all' | 'device_management' | 'tech_product' | 'sales' | 'training';
  setActiveCategory: (val: 'all' | 'device_management' | 'tech_product' | 'sales' | 'training') => void;
  orders: Order[];
  createOrder: (order: Partial<Order>) => Promise<boolean>;
  clients: Client[];
  showNewOrderButton?: boolean;
}

export function Header({
  searchQuery,
  setSearchQuery,
  activeCategory,
  setActiveCategory,
  createOrder,
  clients,
  showNewOrderButton = true
}: HeaderProps) {
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);

  return (
    <header className="bg-background/80 backdrop-blur-md border-b border-border shrink-0 z-10 px-4 md:px-8 py-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder="Search orders, clients, IDs..."
            className="pl-10 bg-muted/30 border-border focus-visible:ring-primary/30 rounded-xl h-9 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {showNewOrderButton && (
          <div className="shrink-0">
            <NewOrderDialog
              isOpen={isNewOrderOpen}
              setIsOpen={setIsNewOrderOpen}
              createOrder={createOrder}
              clients={clients}
            />
          </div>
        )}
      </div>
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as any)} className="mt-2">
        <TabsList className="bg-muted/50 p-1 rounded-lg h-8 w-full md:w-auto">
          <TabsTrigger value="all" className="flex-1 md:flex-none text-[10px] font-bold uppercase tracking-wider px-3 h-6 rounded-md data-[state=active]:bg-card data-[state=active]:text-primary">All</TabsTrigger>
          <TabsTrigger value="device_management" className="flex-1 md:flex-none text-[10px] font-bold uppercase tracking-wider px-3 h-6 rounded-md data-[state=active]:bg-card data-[state=active]:text-primary">Device Management</TabsTrigger>
          <TabsTrigger value="tech_product" className="flex-1 md:flex-none text-[10px] font-bold uppercase tracking-wider px-3 h-6 rounded-md data-[state=active]:bg-card data-[state=active]:text-primary">Tech Services</TabsTrigger>
          <TabsTrigger value="sales" className="flex-1 md:flex-none text-[10px] font-bold uppercase tracking-wider px-3 h-6 rounded-md data-[state=active]:bg-card data-[state=active]:text-primary">Sales</TabsTrigger>
          <TabsTrigger value="training" className="flex-1 md:flex-none text-[10px] font-bold uppercase tracking-wider px-3 h-6 rounded-md data-[state=active]:bg-card data-[state=active]:text-primary">Training</TabsTrigger>
        </TabsList>
      </Tabs>
    </header>
  );
}
