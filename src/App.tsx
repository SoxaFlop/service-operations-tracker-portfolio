import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';

import { useAuth } from './hooks/useAuth';
import { useOrders } from './hooks/useOrders';
import { useTheme } from './hooks/useTheme';
import { useClients } from './hooks/useClients';
import { useSteps } from './hooks/useSteps';
import { useFilteredOrders } from './hooks/useFilteredOrders';
import { useTabManager } from './hooks/useTabManager';

import { Sidebar } from './components/layout/Sidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { Header } from './components/layout/Header';
import { OrderDetailsDialog } from './components/orders/OrderDetailsDialog';

// Views
import { LoginView } from './components/views/LoginView';
import { DashboardView } from './components/views/DashboardView';
import { CompletedOrdersView } from './components/views/CompletedOrdersView';
import { UsersView } from './components/views/UsersView';
import { ClientsView } from './components/views/ClientsView';
import { SettingsView } from './components/views/SettingsView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { ProposalsView } from './components/views/ProposalsView';

import { Order } from './types';

export default function App() {
  // Auth & Theme
  const {
    user, userProfile, isAuthReady,
    handleSendOtp, handleVerifyOtp,
    handlePasswordLogin, handleSetPassword, checkHasPassword,
    handleLogout
  } = useAuth();
  const { theme, setTheme } = useTheme();
  const themeClass = theme === 'pastel' ? '' : theme;
  const { isDuplicateTab, reactivate } = useTabManager();

  // Step advance permissions for the current user { [stepId]: boolean }
  const [stepPermissions, setStepPermissions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isAuthReady || !user) return;
    const token = localStorage.getItem('token');
    fetch('/api/settings/advance-permissions', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(setStepPermissions)
      .catch(() => { });
  }, [isAuthReady, user]);

  // UI State
  const [sidebarTab, setSidebarTab] = useState<'dashboard' | 'completed' | 'clients' | 'users' | 'settings' | 'analytics' | 'proposals'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'device_management' | 'tech_product' | 'sales' | 'training'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isFetchingOrder, setIsFetchingOrder] = useState(false);

  // Data Fetching
  const { steps, addStep, updateStep, deleteStep, reorderSteps } = useSteps(isAuthReady);
  const { orders, moveOrder, updateOrder, deleteOrder, createOrder, getOrderDetails } = useOrders(isAuthReady, user?.id, user?.displayName, user?.email, steps, isDuplicateTab);
  const { clients, isLoading: isClientsLoading, createClient, updateClient, deleteClient } = useClients(isAuthReady, user?.id);

  const handleViewOrder = async (order: Order) => {
    const id = order.firestoreId || order.id;
    if (!id) return;

    setIsFetchingOrder(true);
    const fullOrder = await getOrderDetails(id);
    if (fullOrder) {
      setSelectedOrder(fullOrder);
    }
    setIsFetchingOrder(false);
  };

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Filtered Data
  const { activeOrders, completedOrders } = useFilteredOrders(orders, searchQuery, activeCategory, steps);

  const isViewer = userProfile?.role === 'viewer';
  const isAdmin = userProfile?.role === 'admin';
  const isBdm = userProfile?.role === 'bdm';
  const isOps = userProfile?.role === 'ops';
  const isUser = userProfile?.role === 'user';

  // Deep linking: check for ?order=dbId in URL
  useEffect(() => {
    if (isAuthReady && user && orders.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const orderDbId = params.get('order');
      if (orderDbId) {
        const order = orders.find(o => o.firestoreId === orderDbId || o.id === orderDbId);
        if (order) {
          handleViewOrder(order);
          const lastStep = steps.length > 0 ? steps[steps.length - 1].id : 'tax_invoice_shared';
          if (order.status === lastStep) {
            setSidebarTab('completed');
          } else {
            setSidebarTab('dashboard');
          }
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
  }, [isAuthReady, user, orders, steps]);

  const onSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail) return;
    setIsLoggingIn(true);
    const success = await handleSendOtp(loginEmail);
    if (success) setOtpSent(true);
    setIsLoggingIn(false);
  };

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginOtp) return;
    setIsLoggingIn(true);
    await handleVerifyOtp(loginEmail, loginOtp);
    setIsLoggingIn(false);
  };

  const onPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;
    setIsLoggingIn(true);
    await handlePasswordLogin(loginEmail, loginPassword);
    setIsLoggingIn(false);
  };

  const formatCurrency = (amount?: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount || 0);
  };

  // Render Login if not authenticated
  if (isAuthReady && !user) {
    return (
      <div className={themeClass}>
        <Toaster position="top-right" richColors />
        <LoginView
          loginEmail={loginEmail}
          setLoginEmail={setLoginEmail}
          loginOtp={loginOtp}
          setLoginOtp={setLoginOtp}
          loginPassword={loginPassword}
          setLoginPassword={setLoginPassword}
          otpSent={otpSent}
          setOtpSent={setOtpSent}
          isLoading={isLoggingIn}
          onSendOtp={onSendOtp}
          onVerifyOtp={onVerifyOtp}
          onPasswordLogin={onPasswordLogin}
          checkHasPassword={checkHasPassword}
        />
      </div>
    );
  }

  const renderView = () => {
    switch (sidebarTab) {
      case 'dashboard':
        return (
          <DashboardView
            orders={orders}
            activeOrders={activeOrders}
            completedOrders={completedOrders}
            steps={steps}
            isAdmin={isAdmin}
            isViewer={isViewer || isBdm}
            searchQuery={searchQuery}
            activeCategory={activeCategory}
            setSelectedOrder={handleViewOrder}
            moveOrder={moveOrder}
            formatCurrency={formatCurrency}
            canAdvanceStep={(stepId: string) => stepPermissions[stepId] ?? true}
          />
        );
      case 'completed':
        return (
          <motion.div key="completed" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full p-8">
            <CompletedOrdersView
              completedOrders={completedOrders}
              formatCurrency={formatCurrency}
              setSelectedOrder={handleViewOrder}
              steps={steps}
              moveOrder={moveOrder}
              isAdmin={isAdmin}
            />
          </motion.div>
        );
      case 'clients':
        if (isViewer) return null;
        return (
          <motion.div key="clients" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full p-8">
            <ClientsView
              clients={clients}
              isLoading={isClientsLoading}
              userProfile={userProfile}
              createClient={createClient}
              updateClient={updateClient}
              deleteClient={deleteClient}
            />
          </motion.div>
        );
      case 'users':
        if (!isAdmin) return null;
        return (
          <motion.div key="users" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full p-8">
            <UsersView isAuthReady={isAuthReady} userProfile={userProfile} />
          </motion.div>
        );
      case 'settings':
        return (
          <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
            <SettingsView
              userProfile={userProfile}
              theme={theme}
              setTheme={setTheme}
              handleLogout={handleLogout}
              orders={orders}
              completedOrders={completedOrders}
              steps={steps}
              addStep={addStep}
              updateStep={updateStep}
              deleteStep={deleteStep}
              reorderSteps={reorderSteps}
              onSetPassword={handleSetPassword}
            />
          </motion.div>
        );
      case 'analytics':
        if (!isAdmin) return null;
        return (
          <motion.div key="analytics" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full p-4 sm:p-6 md:p-8 overflow-y-auto">
            <AnalyticsView />
          </motion.div>
        );
      case 'proposals':
        if (!isBdm && !isAdmin && !isUser) return null;
        return (
          <motion.div key="proposals" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full p-8 overflow-hidden flex flex-col">
            <ProposalsView userProfile={userProfile} isUser={isUser} isPaused={isDuplicateTab} setSidebarTab={setSidebarTab as (tab: string) => void} />
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`app-shell min-h-screen bg-background flex font-sans text-foreground ${themeClass}`}>
      <Toaster position="top-right" richColors />

      <Sidebar
        sidebarTab={sidebarTab}
        setSidebarTab={setSidebarTab}
        userProfile={userProfile}
        user={user}
        handleLogout={handleLogout}
        isViewer={isViewer}
        isBdm={isBdm}
        isUser={isUser}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden md:ml-64 pb-16 md:pb-0">
        {(sidebarTab === 'dashboard' || sidebarTab === 'completed') && (
          <Header
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            orders={orders}
            createOrder={createOrder}
            clients={clients}
            showNewOrderButton={sidebarTab === 'dashboard' && !isViewer && !isBdm && !isOps}
          />
        )}

        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {renderView()}
          </AnimatePresence>
        </div>
      </main>

      <MobileBottomNav
        sidebarTab={sidebarTab}
        setSidebarTab={setSidebarTab}
        userProfile={userProfile}
        isViewer={isViewer}
        isBdm={isBdm}
        isUser={isUser}
      />

      <OrderDetailsDialog
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onUpdate={updateOrder}
        onDelete={deleteOrder}
        formatCurrency={formatCurrency}
        steps={steps}
        isAdmin={isAdmin}
        isViewer={isViewer || isBdm}
        isOps={isOps}
        isUser={isUser}
        onMove={moveOrder}
      />

      {/* Duplicate Tab Overlay */}
      {isDuplicateTab && (
        <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-md flex items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border p-12 rounded-[3rem] shadow-2xl max-w-sm w-full text-center space-y-6"
          >
            <div className="w-20 h-20 bg-indigo-500/10 text-indigo-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M9 15h6"></path><path d="M12 12v6"></path></svg>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Session Moved</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The Service Operations Tracker is open in another tab. To prevent database limits, we've paused this one.
            </p>
            <Button
              onClick={reactivate}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl h-12 shadow-lg shadow-indigo-100"
            >
              Use This Tab Instead
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
