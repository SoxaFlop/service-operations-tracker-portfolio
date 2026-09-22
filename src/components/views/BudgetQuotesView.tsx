import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Receipt } from 'lucide-react';
import { useBudgetQuotes } from '../../hooks/useBudgetQuotes';
import { useClients } from '../../hooks/useClients';
import { BQ_STATUS_CONFIG, BQ_STATUS_ORDER } from '../../constants/budgetQuoteConfig';
import { BudgetQuoteCard } from '../budget-quotes/BudgetQuoteCard';
import { NewBudgetQuoteDialog } from '../budget-quotes/NewBudgetQuoteDialog';
import { BudgetQuoteDetailPanel } from '../budget-quotes/BudgetQuoteDetailPanel';
import { BudgetQuote, UserProfile } from '../../types';

interface BudgetQuotesViewProps {
  userProfile: UserProfile | null;
  setSidebarTab: (tab: string) => void;
  isPaused?: boolean;
}

export function BudgetQuotesView({ userProfile, setSidebarTab, isPaused = false }: BudgetQuotesViewProps) {
  const isAdmin = userProfile?.role === 'admin';
  const isUser = userProfile?.role === 'user';
  const isBdm = userProfile?.role === 'bdm';
  const isViewer = userProfile?.role === 'viewer';

  const {
    budgetQuotes, createBudgetQuote, updateBudgetQuote, deleteBudgetQuote,
    updateStatus, convertToOrder,
  } = useBudgetQuotes(true, userProfile?.uid, isPaused);

  const { clients } = useClients(true, userProfile?.uid);

  const [bdmUsers, setBdmUsers] = useState<Array<{ id: string; displayName: string }>>([]);
  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) return;
    fetch('/api/users', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then((users: any[]) =>
        setBdmUsers(users.filter(u => u.role === 'bdm').map(u => ({ id: u.uid, displayName: u.displayName })))
      )
      .catch(() => {});
  }, []);

  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selected, setSelected] = useState<BudgetQuote | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editQuote, setEditQuote] = useState<BudgetQuote | null>(null);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);

  const openCreate = () => { setEditQuote(null); setShowDialog(true); };
  const openEdit = (q: BudgetQuote) => { setEditQuote(q); setShowDialog(true); };
  const openDetail = (q: BudgetQuote) => { setSelected(q); setView('detail'); };

  const handleSave = async (data: Partial<BudgetQuote>) => {
    const result = editQuote
      ? await updateBudgetQuote(editQuote.id, data)
      : await createBudgetQuote(data);
    if (result) {
      setShowDialog(false);
      if (editQuote) setSelected(result);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`Delete budget quote ${selected.quoteNumber}?`)) return;
    const ok = await deleteBudgetQuote(selected.id);
    if (ok) setView('list');
  };

  const handleMarkSent = async (subject: string) => {
    if (!selected) return;
    const result = await updateStatus(selected.id, 'sent', subject);
    if (result) setSelected(result);
  };

  const handleMarkAccepted = async () => {
    if (!selected) return;
    const result = await updateStatus(selected.id, 'accepted');
    if (result) setSelected(result);
  };

  const handleMarkDeclined = async () => {
    if (!selected) return;
    const result = await updateStatus(selected.id, 'declined');
    if (result) setSelected(result);
  };

  const handleConvertToOrder = async () => {
    if (!selected) return;
    const result = await convertToOrder(selected.id);
    if (result) {
      setSelected(result.budgetQuote);
      setSidebarTab('dashboard');
    }
  };

  // Detail view
  if (view === 'detail' && selected) {
    // Keep selected in sync with live list
    const live = budgetQuotes.find(q => q.id === selected.id) ?? selected;
    return (
      <>
        <BudgetQuoteDetailPanel
          quote={live}
          isAdmin={isAdmin}
          isUser={isUser}
          isBdm={isBdm}
          onBack={() => setView('list')}
          onEdit={() => openEdit(live)}
          onDelete={handleDelete}
          onSubmit={async () => {}}
          onApprove={async () => {}}
          onQuery={async () => {}}
          onMarkSent={handleMarkSent}
          onMarkAccepted={handleMarkAccepted}
          onMarkDeclined={handleMarkDeclined}
          onConvertToOrder={handleConvertToOrder}
          setSidebarTab={setSidebarTab}
          formatCurrency={formatCurrency}
        />
        <NewBudgetQuoteDialog
          isOpen={showDialog}
          onClose={() => setShowDialog(false)}
          onSave={handleSave}
          clients={clients}
          initialData={editQuote}
          bdmUsers={bdmUsers}
          isAdmin={isAdmin}
          isUser={isUser}
        />
      </>
    );
  }

  // List view
  const filtered = statusFilter === 'all'
    ? budgetQuotes
    : budgetQuotes.filter(q => q.status === statusFilter);

  return (
    <div className="space-y-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budget Quotes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin || isUser ? 'Track client budget requests and convert to orders' : 'Your budget quote requests'}
          </p>
        </div>
        {(isAdmin || isBdm || isUser) && (
          <Button onClick={openCreate} className="gap-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
            <Plus size={16} /> New Quote
          </Button>
        )}
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap shrink-0">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
            statusFilter === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-border text-muted-foreground hover:border-primary/50'
          }`}
        >
          All <span className="ml-1.5 opacity-60">{budgetQuotes.length}</span>
        </button>
        {BQ_STATUS_ORDER.map(s => {
          const count = budgetQuotes.filter(q => q.status === s).length;
          if (count === 0 && statusFilter !== s) return null;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {BQ_STATUS_CONFIG[s].label} <span className="ml-1.5 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <Receipt size={24} className="text-muted-foreground/30" />
            </div>
            <p className="text-sm font-bold text-muted-foreground">
              {statusFilter === 'all' ? 'No budget quotes yet' : `No ${BQ_STATUS_CONFIG[statusFilter as keyof typeof BQ_STATUS_CONFIG]?.label ?? statusFilter} quotes`}
            </p>
            {!isViewer && statusFilter === 'all' && (
              <p className="text-xs text-muted-foreground/60 mt-1">Create a budget quote to get started</p>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-6">
            {filtered.map(q => (
              <BudgetQuoteCard key={q.id} quote={q} onClick={() => openDetail(q)} formatCurrency={formatCurrency} />
            ))}
          </div>
        )}
      </div>

      <NewBudgetQuoteDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        onSave={handleSave}
        clients={clients}
        initialData={editQuote}
        bdmUsers={bdmUsers}
        isAdmin={isAdmin}
        isUser={isUser}
      />
    </div>
  );
}
