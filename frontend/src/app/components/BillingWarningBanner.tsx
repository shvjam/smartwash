import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, X } from 'lucide-react';
import {
  authApi, billingApi,
  type CurrentTenantDto, type CurrentSubscriptionDto,
  TenantStatus, SubscriptionStatus, ApiException,
} from '../api';
import { useCarWash } from '../store';

type Warn = { bg: string; msg: string } | null;

const toFa = (n: number) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const daysUntil = (iso?: string | null) =>
  iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)) : null;

const AMBER = 'bg-amber-50 border-amber-200 text-amber-800';
const RED = 'bg-red-50 border-red-200 text-red-800';
const GRAY = 'bg-gray-50 border-gray-200 text-gray-700';

/**
 * نوار هشدار بیلینگ — بر پایه‌ی وضعیتِ واقعیِ مستاجر (‎/me/tenant) و اشتراک ساخته می‌شود.
 * منطق دقیقاً منطبق با enumهای بک‌اند:
 *   TenantStatus: Trial=0, Active=1, Grace=2, Suspended=3, Cancelled=4, Expired=5, Archived=6
 *   SubscriptionStatus: PendingPayment=0, Active=1, PastDue=2, Cancelled=3, Expired=4
 */
function buildWarning(tenant: CurrentTenantDto, sub: CurrentSubscriptionDto | null): Warn {
  // ۱) وضعیتِ مستاجر مقدم است — Grace یعنی فقط‌خواندنی، تعلیق/انقضا یعنی مسدود.
  switch (tenant.status) {
    case TenantStatus.Grace: {
      const left = daysUntil(sub?.graceEndsAtUtc) ?? daysUntil(tenant.trialEndsAtUtc);
      const tail = left != null ? ` ${toFa(left)} روز تا تعلیق حساب باقی مانده.` : '';
      return { bg: AMBER, msg: `اشتراک شما در دوره مهلت است و حساب فقط‌خواندنی شده؛ برای ادامه‌ی فعالیت صورتحساب را پرداخت کنید.${tail}` };
    }
    case TenantStatus.Suspended:
      return { bg: RED, msg: 'حساب شما تعلیق شده است. برای رفعِ تعلیق، اشتراک را پرداخت/تمدید کنید.' };
    case TenantStatus.Expired:
      return { bg: RED, msg: 'اشتراک شما منقضی شده است. برای ادامه‌ی استفاده اشتراک تهیه کنید.' };
    case TenantStatus.Cancelled:
      return { bg: GRAY, msg: 'اشتراک شما لغو شده است. برای فعال‌سازی مجدد اشتراک تهیه کنید.' };
    case TenantStatus.Archived:
      return { bg: GRAY, msg: 'این حساب آرشیو شده است.' };
  }

  // ۲) مستاجر فعال/آزمایشی است — فقط در صورتِ مشکلِ پرداختِ اشتراک هشدار بده.
  if (sub) {
    if (sub.status === SubscriptionStatus.PastDue)
      return { bg: RED, msg: 'پرداخت اشتراک معوق است. لطفاً هرچه سریع‌تر پرداخت کنید.' };
    if (sub.status === SubscriptionStatus.PendingPayment)
      return { bg: AMBER, msg: 'صورتحساب اشتراک در انتظار پرداخت است. برای فعال‌سازی، پرداخت را تکمیل کنید.' };
  }

  // ۳) دوره‌ی آزمایشی رو به پایان (۳ روز مانده) — یادآوریِ ملایم.
  if (tenant.status === TenantStatus.Trial) {
    const left = daysUntil(tenant.trialEndsAtUtc);
    if (left != null && left <= 3)
      return { bg: AMBER, msg: `دوره آزمایشی شما ${toFa(left)} روز دیگر پایان می‌یابد. برای ادامه، اشتراک تهیه کنید.` };
  }

  return null;
}

export const BillingWarningBanner: React.FC = () => {
  const { user } = useCarWash();
  const [warn, setWarn] = useState<Warn>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || user.isPlatformAdmin || !user.tenantId) { setWarn(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const tenant = await authApi.currentTenant();
        // اشتراک ممکن است وجود نداشته باشد یا در Grace با 403 برگردد — بی‌اهمیت است.
        let sub: CurrentSubscriptionDto | null = null;
        try { sub = await billingApi.subscription(); }
        catch (e) { if (!(e instanceof ApiException)) throw e; }
        if (!cancelled) setWarn(buildWarning(tenant, sub));
      } catch { if (!cancelled) setWarn(null); }
    })();
    return () => { cancelled = true; };
  }, [user?.tenantId]);

  if (dismissed || !warn) return null;

  return (
    <div className={`border-b px-4 py-2.5 flex items-center justify-between gap-3 text-sm ${warn.bg}`} dir="rtl">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="flex-shrink-0" />
        <span>{warn.msg}</span>
        <Link to="/app/billing" className="underline font-bold hover:no-underline mr-1">
          مدیریت اشتراک
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded-full hover:bg-black/10 transition-colors flex-shrink-0"
        aria-label="بستن"
      >
        <X size={14} />
      </button>
    </div>
  );
};
