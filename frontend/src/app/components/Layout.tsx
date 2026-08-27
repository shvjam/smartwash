import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Navigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Car, Users, UserSquare2, LineChart, LogOut, Menu, Sparkles, CalendarClock, Building2, Clock, Receipt, Megaphone, Settings, CreditCard, User as UserIcon, Shield, ShoppingBag, Bell as BellIcon, BellRing, Sun, Moon, UserCog, LifeBuoy, MessageSquare } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useCarWash } from '../store';
import { clsx } from 'clsx';
import { NotificationsBell } from './NotificationsBell';
import { Logo, BRAND_NAME, BRAND_TAGLINE } from './Logo';
import { onboardingApi } from '../api';
import { useFeatures } from '../lib/features';
import { usePermissionCheck } from '../lib/rbac';
import { BillingWarningBanner } from './BillingWarningBanner';

const navItems: Array<{ name: string; icon: any; path: string; roles: string[]; feature?: string; permission?: string }> = [
  { name: 'جایگاه‌ها',        icon: Car,          path: '/app/bays',          roles: ['admin', 'user'], permission: 'tenant.bays.*' },
  { name: 'سفارش‌ها',         icon: ShoppingBag,  path: '/app/orders',         roles: ['admin', 'user'], permission: 'tenant.orders.*' },
  { name: 'رزروها',           icon: CalendarClock, path: '/app/reservations',  roles: ['admin', 'user'], feature: 'reservations', permission: 'tenant.reservations.*' },
  { name: 'باشگاه مشتریان',   icon: Users,        path: '/app/crm',            roles: ['admin', 'user'], permission: 'tenant.customers.*' },
  { name: 'شیفت‌ها',          icon: Clock,        path: '/app/shifts',         roles: ['admin', 'user'], permission: 'tenant.shifts.*' },
  { name: 'پرسنل',            icon: UserSquare2,  path: '/app/workers',        roles: ['admin'], permission: 'tenant.workers.*' },
  { name: 'خدمات',            icon: Sparkles,     path: '/app/services',       roles: ['admin'], permission: 'tenant.services.*' },
  { name: 'شعب',              icon: Building2,    path: '/app/branches',       roles: ['admin'], permission: 'tenant.branches.*' },
  { name: 'کاربران',          icon: UserCog,      path: '/app/users',          roles: ['admin'], permission: 'tenant.users.*' },
  { name: 'هزینه‌ها',         icon: Receipt,      path: '/app/expenses',       roles: ['admin'], permission: 'tenant.expenses.*' },
  { name: 'کمپین‌های پیامکی', icon: Megaphone,    path: '/app/campaigns',      roles: ['admin'], feature: 'campaigns', permission: 'tenant.campaigns.*' },
  { name: 'یادآور خدمات',     icon: BellRing,     path: '/app/reminders',      roles: ['admin', 'user'], feature: 'sms', permission: 'tenant.customers.*' },
  { name: 'سرویس پیامک',      icon: MessageSquare, path: '/app/sms',           roles: ['admin'], feature: 'sms', permission: 'tenant.sms.*' },
  { name: 'اعلان‌ها',         icon: BellIcon,     path: '/app/notifications',  roles: ['admin', 'user'], permission: 'tenant.notifications.*' },
  { name: 'گزارشات مالی',     icon: LineChart,    path: '/app/reports',        roles: ['admin'], permission: 'tenant.reports.*' },
  { name: 'تنظیمات',          icon: Settings,     path: '/app/settings',       roles: ['admin'], permission: 'tenant.settings.*' },
  { name: 'اشتراک و صورتحساب', icon: CreditCard, path: '/app/billing',        roles: ['admin'], permission: 'tenant.billing.*' },
  // پشتیبانی قابلیت پایه‌ی هر کارواش است و به پلن یا مجوز اختیاری وابسته نیست؛
  // مجوز tenant.support.manage همچنان در سمت API اعمال می‌شود.
  { name: 'پشتیبانی',         icon: LifeBuoy,     path: '/app/support',        roles: ['admin', 'user'] },
];

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'روشن' : 'تیره'}
      className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
};

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { role, setRole, user, logout, branches, branchId, switchBranch } = useCarWash();
  const { has: hasFeature } = useFeatures();
  const navigate = useNavigate();
  const canAccess = usePermissionCheck();
  const items = navItems.filter(i =>
    i.roles.includes(role) &&
    (!i.feature || hasFeature(i.feature)) &&
    canAccess(i.permission),
  );

  return (
    <>
      <div className="p-6 flex items-center gap-3">
        <Logo size={56} />
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-lg text-gray-900 dark:text-gray-100 tracking-tight leading-tight">{BRAND_NAME}</div>
          {/* Branch selector — فقط اگر بیشتر از یک شعبه وجود داشته باشد */}
          {branches.length > 1 ? (
            <select
              value={branchId ?? ''}
              onChange={e => { switchBranch(e.target.value); onNavigate?.(); }}
              className="mt-1 w-full text-[10px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-1 font-medium text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}{b.isDefault ? ' ★' : ''}</option>
              ))}
            </select>
          ) : (
            <div className="text-[10px] text-gray-400 dark:text-gray-500">{BRAND_TAGLINE}</div>
          )}
        </div>
        <ThemeToggle />
        <NotificationsBell />
      </div>

      <nav className="flex-1 px-4 space-y-1.5 mt-2 overflow-y-auto">
        {items.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300',
              isActive
                ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
            )}
          >
            <item.icon size={20} />
            <span className="text-sm">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-50 dark:border-gray-800 space-y-2">
        <NavLink to="/app/profile" onClick={onNavigate}
          className={({ isActive }) => clsx(
            'flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-colors text-sm',
            isActive ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
          )}>
          <UserIcon size={18} />پروفایل من
        </NavLink>
        {user?.isPlatformAdmin && (
          <NavLink to="/platform/tenants" onClick={onNavigate}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-950/60 transition-colors text-sm font-bold">
            <Shield size={18} />پنل پلتفرم
          </NavLink>
        )}
        {user && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-white flex items-center justify-center text-xs font-bold">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{user.name}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{user.username}</div>
              </div>
            </div>
            <select
              value={role}
              onChange={e => setRole(e.target.value as any)}
              className="w-full text-[11px] bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 font-medium text-gray-900 dark:text-gray-100 focus:outline-none cursor-pointer"
            >
              <option value="admin">دسترسی: مدیر</option>
              <option value="user">دسترسی: کاربر</option>
            </select>
          </div>
        )}
        <button
          onClick={() => { logout(); navigate('/login', { replace: true }); }}
          className="flex items-center gap-3 px-4 py-3 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 w-full rounded-2xl transition-colors"
        >
          <LogOut size={20} />
          <span className="text-sm">خروج از سیستم</span>
        </button>
      </div>
    </>
  );
};

export const Layout = () => {
  const { user } = useCarWash();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!user || user.isPlatformAdmin) { setOnboardingChecked(true); return; }
    let alive = true;
    onboardingApi.state()
      .then(s => {
        if (alive) {
          // isComplete از backend، یا اگر hasBranch+hasBay+hasService همه true باشند (data از register seed شده)
          const done = s.isComplete || (s.hasBranch && s.hasBay && s.hasService);
          setNeedsOnboarding(!done);
          setOnboardingChecked(true);
        }
      })
      .catch(() => { if (alive) setOnboardingChecked(true); });
    return () => { alive = false; };
  }, [user]);

  if (!user) return <Navigate to="/login" replace />;
  if (onboardingChecked && needsOnboarding && !location.pathname.startsWith('/app/onboarding')) {
    return <Navigate to="/app/onboarding" replace />;
  }

  return (
    <div dir="rtl" className="flex h-screen bg-[#f5f5f7] dark:bg-gray-950 overflow-hidden text-right text-gray-900 dark:text-gray-100">
      <aside className="hidden lg:flex flex-col bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 w-[240px] xl:w-[260px] shadow-[2px_0_10px_rgba(0,0,0,0.02)] z-20 my-4 ml-4 rounded-r-3xl">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="lg:hidden fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40"
          />
        )}
        {mobileOpen && (
          <motion.aside
            key="mobile-drawer"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="lg:hidden fixed top-0 right-0 bottom-0 w-[85vw] max-w-[320px] bg-white dark:bg-gray-900 z-50 flex flex-col shadow-2xl"
          >
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Logo size={44} />
            <span className="font-extrabold text-gray-900 dark:text-gray-100">{BRAND_NAME}</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationsBell />
            <button onClick={() => setMobileOpen(true)} className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              <Menu size={20} />
            </button>
          </div>
        </header>

        {/* هشدار بیلینگ — فقط در صورت مشکل اشتراک نمایش داده می‌شود */}
        {!user?.isPlatformAdmin && <BillingWarningBanner />}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 lg:p-6 xl:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
