import React, { useEffect } from 'react';
import { RouterProvider, createBrowserRouter, Navigate } from 'react-router';
import { ThemeProvider } from 'next-themes';
import { PublicLayout } from './components/public/PublicLayout';
import { LoginView, PlatformLoginView } from './pages/Login';
import { Landing } from './pages/public/Landing';
import { Pricing } from './pages/public/Pricing';
import { Features } from './pages/public/Features';
import { Contact } from './pages/public/Contact';
import { Register } from './pages/public/Register';
import { ForgotPassword } from './pages/public/ForgotPassword';
import { FeaturesProvider } from './lib/features';
import { RbacProvider } from './lib/rbac';
import { CarWashProvider, useCarWash } from './store';
import { BrandingProvider } from './lib/branding';
import { NetworkActivityBar } from './components/NetworkActivityBar';
import { Toaster } from './components/ui/sonner';
import { normalizeDigits } from './lib/persian';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';

/**
 * A route's page, fetched the first time that route is opened.
 *
 * The public pages stay in the first bundle because they are what a visitor came for; the
 * panel is code they only need once signed in, and it is several times larger.
 */
const PageLoading = () => (
  <div dir="rtl" className="flex min-h-[60vh] items-center justify-center">
    <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
  </div>
);

const lazyPage = (load: () => Promise<Record<string, unknown>>, name: string) => {
  const Loaded = React.lazy(async () => ({ default: (await load())[name] as React.ComponentType }));
  return () => (
    <React.Suspense fallback={<PageLoading />}>
      <Loaded />
    </React.Suspense>
  );
};

const Layout = lazyPage(() => import('./components/Layout'), 'Layout');
const PlatformLayout = lazyPage(() => import('./components/platform/PlatformLayout'), 'PlatformLayout');
const BaysDashboard = lazyPage(() => import('./pages/BaysView'), 'BaysDashboard');
const CRMView = lazyPage(() => import('./pages/CRMView'), 'CRMView');
const ReportsView = lazyPage(() => import('./pages/ReportsView'), 'ReportsView');
const WorkersView = lazyPage(() => import('./pages/WorkersView'), 'WorkersView');
const ReservationsView = lazyPage(() => import('./pages/ReservationsView'), 'ReservationsView');
const BranchesView = lazyPage(() => import('./pages/app/BranchesView'), 'BranchesView');
const UsersView = lazyPage(() => import('./pages/app/UsersView'), 'UsersView');
const ShiftsView = lazyPage(() => import('./pages/app/ShiftsView'), 'ShiftsView');
const ExpensesView = lazyPage(() => import('./pages/app/ExpensesView'), 'ExpensesView');
const CampaignsView = lazyPage(() => import('./pages/app/CampaignsView'), 'CampaignsView');
const SettingsView = lazyPage(() => import('./pages/app/SettingsView'), 'SettingsView');
const BillingView = lazyPage(() => import('./pages/app/BillingView'), 'BillingView');
const ProfileView = lazyPage(() => import('./pages/app/ProfileView'), 'ProfileView');
const OnboardingWizard = lazyPage(() => import('./pages/app/OnboardingWizard'), 'OnboardingWizard');
const ServicesView = lazyPage(() => import('./pages/app/ServicesView'), 'ServicesView');
const CustomerDetailView = lazyPage(() => import('./pages/app/CustomerDetailView'), 'CustomerDetailView');
const OrdersView = lazyPage(() => import('./pages/app/OrdersView'), 'OrdersView');
const OrderDetailView = lazyPage(() => import('./pages/app/OrderDetailView'), 'OrderDetailView');
const ReservationDetailView = lazyPage(() => import('./pages/app/ReservationDetailView'), 'ReservationDetailView');
const ReservationCreateView = lazyPage(() => import('./pages/app/ReservationCreateView'), 'ReservationCreateView');
const NotificationsView = lazyPage(() => import('./pages/app/NotificationsView'), 'NotificationsView');
const RemindersView = lazyPage(() => import('./pages/app/RemindersView'), 'RemindersView');
const WorkerDetailView = lazyPage(() => import('./pages/app/WorkerDetailView'), 'WorkerDetailView');
const PaymentResultView = lazyPage(() => import('./pages/app/PaymentResultView'), 'PaymentResultView');
const TenantsAdmin = lazyPage(() => import('./pages/platform/TenantsAdmin'), 'TenantsAdmin');
const PlansAdmin = lazyPage(() => import('./pages/platform/PlansAdmin'), 'PlansAdmin');
const SubscriptionsAdmin = lazyPage(() => import('./pages/platform/SubscriptionsAdmin'), 'SubscriptionsAdmin');
const AuditLogView = lazyPage(() => import('./pages/platform/AuditLogView'), 'AuditLogView');
const TenantDetailView = lazyPage(() => import('./pages/platform/TenantDetailView'), 'TenantDetailView');
const PlatformSmsView = lazyPage(() => import('./pages/platform/PlatformSmsView'), 'PlatformSmsView');
const TicketsAdmin = lazyPage(() => import('./pages/platform/TicketsAdmin'), 'TicketsAdmin');
const SupportView = lazyPage(() => import('./pages/app/SupportView'), 'SupportView');
const SmsView = lazyPage(() => import('./pages/app/SmsView'), 'SmsView');
const SupportTicketDetailView = lazyPage(() => import('./pages/app/SupportTicketDetailView'), 'SupportTicketDetailView');
const RostersView = lazyPage(() => import('./pages/app/RostersView'), 'RostersView');
const TipSettlementView = lazyPage(() => import('./pages/app/TipSettlementView'), 'TipSettlementView');


const AdminOnly = ({ children }: { children: React.ReactNode }) => {
  const { role } = useCarWash();
  if (role !== 'admin') return <Navigate to="/app/bays" replace />;
  return <>{children}</>;
};

const RequireAuth = ({ children, loginPath = '/login' }: { children: React.ReactNode; loginPath?: string }) => {
  const { user, ready } = useCarWash();
  if (!ready) return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
      <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
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
      { path: 'rosters', element: <AdminOnly><RostersView /></AdminOnly> },
      { path: 'tips', element: <AdminOnly><TipSettlementView /></AdminOnly> },
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
            <BrandingProvider>
              <div className="notranslate" translate="no">
                <NetworkActivityBar />
                <RouterProvider router={router} />
                <Toaster position="top-center" richColors closeButton dir="rtl" />
              </div>
            </BrandingProvider>
          </FeaturesProvider>
        </RbacProvider>
      </CarWashProvider>
    </ThemeProvider>
  );
}
