import React, { useEffect } from 'react';
import { RouterProvider, createBrowserRouter, Navigate } from 'react-router';
import { ThemeProvider } from 'next-themes';
import { Layout } from './components/Layout';
import { PublicLayout } from './components/public/PublicLayout';
import { PlatformLayout } from './components/platform/PlatformLayout';
import { BaysDashboard } from './pages/BaysView';
import { CRMView } from './pages/CRMView';
import { ReportsView } from './pages/ReportsView';
import { WorkersView } from './pages/WorkersView';
import { ReservationsView } from './pages/ReservationsView';
import { LoginView, PlatformLoginView } from './pages/Login';
import { Landing } from './pages/public/Landing';
import { Pricing } from './pages/public/Pricing';
import { Features } from './pages/public/Features';
import { Contact } from './pages/public/Contact';
import { Register } from './pages/public/Register';
import { ForgotPassword } from './pages/public/ForgotPassword';
import { BranchesView } from './pages/app/BranchesView';
import { UsersView } from './pages/app/UsersView';
import { ShiftsView } from './pages/app/ShiftsView';
import { ExpensesView } from './pages/app/ExpensesView';
import { CampaignsView } from './pages/app/CampaignsView';
import { SettingsView } from './pages/app/SettingsView';
import { BillingView } from './pages/app/BillingView';
import { ProfileView } from './pages/app/ProfileView';
import { OnboardingWizard } from './pages/app/OnboardingWizard';
import { ServicesView } from './pages/app/ServicesView';
import { CustomerDetailView } from './pages/app/CustomerDetailView';
import { OrdersView } from './pages/app/OrdersView';
import { OrderDetailView } from './pages/app/OrderDetailView';
import { ReservationDetailView } from './pages/app/ReservationDetailView';
import { ReservationCreateView } from './pages/app/ReservationCreateView';
import { NotificationsView } from './pages/app/NotificationsView';
import { RemindersView } from './pages/app/RemindersView';
import { WorkerDetailView } from './pages/app/WorkerDetailView';
import { PaymentResultView } from './pages/app/PaymentResultView';
import { FeaturesProvider } from './lib/features';
import { RbacProvider } from './lib/rbac';
import { TenantsAdmin } from './pages/platform/TenantsAdmin';
import { PlansAdmin } from './pages/platform/PlansAdmin';
import { SubscriptionsAdmin } from './pages/platform/SubscriptionsAdmin';
import { AuditLogView } from './pages/platform/AuditLogView';
import { TenantDetailView } from './pages/platform/TenantDetailView';
import { PlatformSmsView } from './pages/platform/PlatformSmsView';
import { TicketsAdmin } from './pages/platform/TicketsAdmin';
import { SupportView } from './pages/app/SupportView';
import { SmsView } from './pages/app/SmsView';
import { SupportTicketDetailView } from './pages/app/SupportTicketDetailView';
import { CarWashProvider, useCarWash } from './store';
import { ThemeSyncer } from './components/ThemeSyncer';
import { Toaster } from './components/ui/sonner';
import { normalizeDigits } from './lib/persian';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';

const AdminOnly = ({ children }: { children: React.ReactNode }) => {
  const { role } = useCarWash();
  if (role !== 'admin') return <Navigate to="/app/bays" replace />;
  return <>{children}</>;
};

const RequireAuth = ({ children, loginPath = '/login' }: { children: React.ReactNode; loginPath?: string }) => {
  const { user, ready } = useCarWash();
  if (!ready) return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
      <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to={loginPath} replace />;
  return <>{children}</>;
};

const router = createBrowserRouter([
  {
    path: '/',
    Component: PublicLayout,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, Component: Landing },
      { path: 'pricing', Component: Pricing },
      { path: 'features', Component: Features },
      { path: 'contact', Component: Contact },
    ],
  },
  { path: '/login', Component: LoginView, errorElement: <RouteErrorBoundary /> },
  { path: '/platform/login', Component: PlatformLoginView, errorElement: <RouteErrorBoundary /> },
  { path: '/register', Component: Register, errorElement: <RouteErrorBoundary /> },
  { path: '/forgot-password', Component: ForgotPassword, errorElement: <RouteErrorBoundary /> },
  {
    path: '/app',
    element: <RequireAuth><Layout /></RequireAuth>,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/app/bays" replace /> },
      { path: 'bays', Component: BaysDashboard },
      { path: 'reservations', Component: ReservationsView },
      { path: 'reservations/new', Component: ReservationCreateView },
      { path: 'reservations/:id', Component: ReservationDetailView },
      { path: 'orders', Component: OrdersView },
      { path: 'orders/:id', Component: OrderDetailView },
      { path: 'crm', Component: CRMView },
      { path: 'customers/:id', Component: CustomerDetailView },
      { path: 'workers', element: <AdminOnly><WorkersView /></AdminOnly> },
      { path: 'workers/:id', element: <AdminOnly><WorkerDetailView /></AdminOnly> },
      { path: 'notifications', Component: NotificationsView },
      { path: 'reminders', Component: RemindersView },
      { path: 'services', element: <AdminOnly><ServicesView /></AdminOnly> },
      { path: 'reports', element: <AdminOnly><ReportsView /></AdminOnly> },
      { path: 'branches', element: <AdminOnly><BranchesView /></AdminOnly> },
      { path: 'users', element: <AdminOnly><UsersView /></AdminOnly> },
      { path: 'shifts', Component: ShiftsView },
      { path: 'expenses', element: <AdminOnly><ExpensesView /></AdminOnly> },
      { path: 'campaigns', element: <AdminOnly><CampaignsView /></AdminOnly> },
      { path: 'settings', element: <AdminOnly><SettingsView /></AdminOnly> },
      { path: 'billing', element: <AdminOnly><BillingView /></AdminOnly> },
      { path: 'billing/result', Component: PaymentResultView },
      { path: 'sms', element: <AdminOnly><SmsView /></AdminOnly> },
      { path: 'support', Component: SupportView },
      { path: 'support/:id', Component: SupportTicketDetailView },
      { path: 'profile', Component: ProfileView },
      { path: 'onboarding', Component: OnboardingWizard },
      { path: '*', element: <Navigate to="/app/bays" replace /> },
    ],
  },
  {
    path: '/platform',
    element: <RequireAuth loginPath="/platform/login"><PlatformLayout /></RequireAuth>,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/platform/tenants" replace /> },
      { path: 'tenants', Component: TenantsAdmin },
      { path: 'tenants/:id', Component: TenantDetailView },
      { path: 'plans', Component: PlansAdmin },
      { path: 'subscriptions', Component: SubscriptionsAdmin },
      { path: 'audit', Component: AuditLogView },
      { path: 'sms', Component: PlatformSmsView },
      { path: 'tickets', Component: TicketsAdmin },
      { path: '*', element: <Navigate to="/platform/tenants" replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace />, errorElement: <RouteErrorBoundary /> },
]);

export default function App() {
  // Persian keyboards emit Persian/Arabic digits. API validation and fields such
  // as phone numbers need ASCII digits, while rendered values remain fa-IR.
  useEffect(() => {
    const normalizeInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      if (target.type === 'password') return;
      const normalized = normalizeDigits(target.value);
      if (normalized !== target.value) target.value = normalized;
    };
    document.addEventListener('input', normalizeInput, true);
    return () => document.removeEventListener('input', normalizeInput, true);
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <CarWashProvider>
        <RbacProvider>
          <FeaturesProvider>
            <div className="notranslate" translate="no">
              <ThemeSyncer />
              <RouterProvider router={router} />
              <Toaster position="top-center" richColors closeButton dir="rtl" />
            </div>
          </FeaturesProvider>
        </RbacProvider>
      </CarWashProvider>
    </ThemeProvider>
  );
}
