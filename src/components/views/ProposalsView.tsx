import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Receipt } from 'lucide-react';
import { useBudgetQuotes } from '../../hooks/useBudgetQuotes';
import { useClients } from '../../hooks/useClients';
import { BQ_STATUS_CONFIG, BQ_STATUS_ORDER } from '../../constants/budgetQuoteConfig';
import { BudgetQuoteCard } from '../budget-quotes/BudgetQuoteCard';
import { BudgetQuoteFormView } from '../budget-quotes/BudgetQuoteFormView';
import { BudgetQuoteDetailPanel } from '../budget-quotes/BudgetQuoteDetailPanel';
import { BudgetQuote, UserProfile } from '../../types';
import { toast } from 'sonner';

interface AssignableUser {
  id: string;
  displayName: string;
  role: string;
}

interface ProposalsViewProps {
  userProfile: UserProfile | null;
  isUser?: boolean;
  isPaused?: boolean;
  setSidebarTab?: (tab: string) => void;
}

export function ProposalsView({ userProfile, isUser = false, isPaused = false, setSidebarTab }: ProposalsViewProps) {
  const isAdmin = userProfile?.role === 'admin';
  const isBdm = userProfile?.role === 'bdm';
  const isViewer = userProfile?.role === 'viewer';

  const {
    budgetQuotes,
    createBudgetQuote,
    updateBudgetQuote,
    deleteBudgetQuote,
    submitBudgetQuote,
    approveBudgetQuote,
    queryBudgetQuote,
    updateStatus,
    convertToOrder,
  } = useBudgetQuotes(true, userProfile?.uid, isPaused);

  const { clients } = useClients(true, userProfile?.uid);

  const [bdmUsers, setBdmUsers] = useState<Array<{ id: string; displayName: string }>>([]);
  const [availableUsers, setAvailableUsers] = useState<AssignableUser[]>([]);
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [selectedQuote, setSelectedQuote] = useState<BudgetQuote | null>(null);
  const [editingQuote, setEditingQuote] = useState<BudgetQuote | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch('/api/auth/users?assignable=all', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(response => response.json())
      .then((users: any[]) => {
        setBdmUsers(
          users
            .filter(user => user.role === 'bdm')
            .map(user => ({ id: user.uid, displayName: user.displayName }))
        );
        setAvailableUsers(
          users.map(user => ({
            id: user.uid,
            displayName: user.displayName,
            role: user.role,
          }))
        );
      })
      .catch(() => {});
  }, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);

  const openCreate = () => {
    setEditingQuote(null);
    setView('form');
  };

  const openEdit = (quote: BudgetQuote) => {
    setEditingQuote(quote);
    setView('form');
  };

  const openDetail = (quote: BudgetQuote) => {
    setSelectedQuote(quote);
    setView('detail');
  };

  const handleSave = async (data: any) => {
    if (!data.clientId) {
      toast.error('Client is required');
      return;
    }

    setIsSaving(true);
    const result = editingQuote
      ? await updateBudgetQuote(editingQuote.id, data)
      : await createBudgetQuote(data);
    setIsSaving(false);

    if (result) {
      setView(editingQuote ? 'detail' : 'list');
      if (editingQuote) setSelectedQuote(result);
      setEditingQuote(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedQuote) return;
    if (!confirm(`Delete budget quote ${selectedQuote.quoteNumber}?`)) return;

    const deleted = await deleteBudgetQuote(selectedQuote.id);
    if (deleted) setView('list');
  };

  const handleSubmit = async () => {
    if (!selectedQuote) return;
    setIsSaving(true);
    const result = await submitBudgetQuote(selectedQuote.id);
    setIsSaving(false);
    if (result) setSelectedQuote(result);
  };

  const handleApprove = async (notes?: string) => {
    if (!selectedQuote) return;
    setIsSaving(true);
    const result = await approveBudgetQuote(selectedQuote.id, notes);
    setIsSaving(false);
    if (result) setSelectedQuote(result);
  };

  const handleQuery = async (notes: string) => {
    if (!selectedQuote) return;
    setIsSaving(true);
    const result = await queryBudgetQuote(selectedQuote.id, notes);
    setIsSaving(false);
    if (result) setSelectedQuote(result);
  };

  const handleMarkSent = async (subject: string) => {
    if (!selectedQuote) return;
    setIsSaving(true);
    const result = await updateStatus(selectedQuote.id, 'sent', subject);
    setIsSaving(false);
    if (result) setSelectedQuote(result);
  };

  const handleMarkAccepted = async () => {
    if (!selectedQuote) return;
    setIsSaving(true);
    const result = await updateStatus(selectedQuote.id, 'accepted');
    setIsSaving(false);
    if (result) setSelectedQuote(result);
  };

  const handleMarkDeclined = async () => {
    if (!selectedQuote) return;
    setIsSaving(true);
    const result = await updateStatus(selectedQuote.id, 'declined');
    setIsSaving(false);
    if (result) setSelectedQuote(result);
  };

  const handleConvertToOrder = async () => {
    if (!selectedQuote) return;
    setIsSaving(true);
    const result = await convertToOrder(selectedQuote.id);
    setIsSaving(false);

    if (result) {
      setSelectedQuote(result.budgetQuote);
      setSidebarTab?.('dashboard');
    }
  };

  if (view === 'form') {
    const liveQuote = editingQuote
      ? budgetQuotes.find(quote => quote.id === editingQuote.id) ?? editingQuote
      : null;

    return (
      <BudgetQuoteFormView
        initialData={liveQuote}
        clients={clients}
        bdmUsers={bdmUsers}
        availableUsers={availableUsers}
        isAdmin={isAdmin}
        isUser={isUser}
        isBdm={isBdm}
        isSaving={isSaving}
        onBack={() => {
          setView(editingQuote ? 'detail' : 'list');
          setEditingQuote(null);
        }}
        onSave={handleSave}
      />
    );
  }

  if (view === 'detail' && selectedQuote) {
    const liveQuote = budgetQuotes.find(quote => quote.id === selectedQuote.id) ?? selectedQuote;

    return (
      <BudgetQuoteDetailPanel
        quote={liveQuote}
        isAdmin={isAdmin}
        isUser={isUser}
        isBdm={isBdm}
        isSaving={isSaving}
        onBack={() => setView('list')}
        onEdit={() => openEdit(liveQuote)}
        onDelete={handleDelete}
        onSubmit={handleSubmit}
        onApprove={handleApprove}
        onQuery={handleQuery}
        onMarkSent={handleMarkSent}
        onMarkAccepted={handleMarkAccepted}
        onMarkDeclined={handleMarkDeclined}
        onConvertToOrder={handleConvertToOrder}
        setSidebarTab={setSidebarTab ?? (() => {})}
        formatCurrency={formatCurrency}
      />
    );
  }

  const filteredQuotes = statusFilter === 'all'
    ? budgetQuotes
    : budgetQuotes.filter(quote => quote.status === statusFilter);

  return (
    <div className="space-y-5 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proposal Budgetary Quotes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin || isUser
              ? 'Manage client budget estimates and convert them to orders'
              : 'Your proposal budgetary quote requests'}
          </p>
        </div>

        {(isAdmin || isBdm || isUser) && (
          <Button
            onClick={openCreate}
            className="gap-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20"
          >
            <Plus size={16} /> New Quote
          </Button>
        )}
      </div>

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

        {BQ_STATUS_ORDER.map(status => {
          const count = budgetQuotes.filter(quote => quote.status === status).length;
          if (count === 0 && statusFilter !== status) return null;

          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                statusFilter === status
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {BQ_STATUS_CONFIG[status].label}{' '}
              <span className="ml-1.5 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <Receipt size={24} className="text-muted-foreground/30" />
            </div>
            <p className="text-sm font-bold text-muted-foreground">
              {statusFilter === 'all'
                ? 'No proposal budgetary quotes yet'
                : `No ${BQ_STATUS_CONFIG[statusFilter as keyof typeof BQ_STATUS_CONFIG]?.label ?? statusFilter} quotes`}
            </p>
            {!isViewer && statusFilter === 'all' && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Create a proposal budgetary quote to get started
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-6">
            {filteredQuotes.map(quote => (
              <BudgetQuoteCard
                key={quote.id}
                quote={quote}
                onClick={() => openDetail(quote)}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
