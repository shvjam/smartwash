import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Navigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Building2, CreditCard, Layers, LogOut, Menu, X, ArrowLeft, ScrollText, MessageSquare, LifeBuoy, Timer } from 'lucide-react';
import { clsx } from 'clsx';
import { useCarWash } from '../../store';
import { Logo, BRAND_NAME } from '../Logo';

const navItems = [
  { name: 'مستاجران', icon: Building2, path: '/platform/tenants' },
  { name: 'پلن‌ها', icon: Layers, path: '/platform/plans' },
  { name: 'اشتراک‌ها', icon: CreditCard, path: '/platform/subscriptions' },
  { name: 'پیامک پلتفرم', icon: MessageSquare, path: '/platform/sms' },
  { name: 'تیکت‌های پشتیبانی', icon: LifeBuoy, path: '/platform/tickets' },
  { name: 'کارهای زمان‌بندی‌شده', icon: Timer, path: '/platform/jobs' },
  { name: 'لاگ ممیزی', icon: ScrollText, path: '/platform/audit' },
];

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { user, logout } = useCarWash();
  const navigate = useNavigate();
  return (
    <>
      <div className="p-6 flex items-center gap-3">
        <Logo size={48} />
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-base text-white tracking-tight">{BRAND_NAME}</div>
          <div className="text-[10px] text-violet-300 flex items-center gap-1"><Shield size={10} />پنل پلتفرم</div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 mt-2">
        {navItems.map(item => (
          <NavLink key={item.path} to={item.path} onClick={onNavigate}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-4 py-3 rounded-2xl transition-all',
              isActive ? 'bg-white/10 text-white font-bold' : 'text-gray-400 hover:bg-white/5 hover:text-white'
            )}
          >
            <item.icon size={20} /><span className="text-sm">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5 space-y-2">
        {user && (
          <div className="px-4 py-3 bg-white/5 rounded-2xl">
            <div className="text-xs font-bold text-white truncate">{user.name}</div>
            <div className="text-[10px] text-gray-400 truncate">{user.username}</div>
          </div>
        )}
        <NavLink to="/app/bays" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-white/5 rounded-2xl text-sm">
          <ArrowLeft size={16} />بازگشت به برنامه
        </NavLink>
        <button onClick={() => { logout(); navigate('/login', { replace: true }); }}
          className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-300 hover:bg-red-500/10 w-full rounded-2xl text-sm">
          <LogOut size={16} />خروج
        </button>
      </div>
    </>
  );
};

export const PlatformLayout = () => {
  const { user, ready } = useCarWash();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  if (!ready) return <div className="min-h-screen flex items-center justify-center bg-gray-950"><div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isPlatformAdmin) return <Navigate to="/app/bays" replace />;

  return (
    <div dir="rtl" className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <aside className="hidden lg:flex flex-col bg-gray-900 border-l border-white/5 w-[240px] xl:w-[260px] z-20 my-4 ml-4 rounded-r-3xl">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              className="lg:hidden fixed top-0 right-0 bottom-0 w-[85vw] max-w-[320px] bg-gray-900 z-50 flex flex-col">
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden bg-gray-900 border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><Logo size={36} /><span className="font-bold text-white text-sm">پلتفرم</span></div>
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-xl bg-white/5"><Menu size={20} /></button>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default PlatformLayout;
