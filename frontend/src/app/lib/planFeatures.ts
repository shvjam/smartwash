import type { PlanFeatureDto } from "../api/types";

/** Capabilities a plan either has or does not. */
const FEATURE_LABELS: Record<string, string> = {
  reservations: "رزرو آنلاین",
  sms: "پنل پیامکی",
  loyalty: "باشگاه مشتریان",
  campaigns: "کمپین‌های بازاریابی",
  wallet: "کیف پول مشتری",
  branding: "لوگو و رنگ اختصاصی",
  reports: "گزارش‌ها",
  support: "پشتیبانی",
  multibranch: "مدیریت چندشعبه‌ای",
  roles: "نقش‌های سفارشی",
  api: "API اختصاصی",
  sla: "SLA سازمانی",
  manager: "حساب‌مدیر اختصاصی",
  "all-pro": "تمام امکانات حرفه‌ای",
};

/**
 * Capabilities that come with a number attached, and the word that number counts.
 *
 * These arrive from the plan as `max_bays: "3"` or `limit.branches: "unlimited"`. Printing the
 * key alone put bare words like "جایگاه" on a pricing card, which says nothing about what is
 * being bought — and keys with a dot were not matched at all, so the card showed
 * "limit.branches" to a customer.
 */
const QUOTA_UNITS: Record<string, string> = {
  max_bays: "جایگاه",
  bays: "جایگاه",
  "limit.bays": "جایگاه",
  max_users: "کاربر",
  users: "کاربر",
  "limit.users": "کاربر",
  workers: "پرسنل",
  max_branches: "شعبه",
  branches: "شعبه",
  "limit.branches": "شعبه",
  max_vehicles: "خودرو برای هر مشتری",
  vehicles: "خودرو برای هر مشتری",
  "limit.vehicles": "خودرو برای هر مشتری",
};

const toFa = (s: string) => s.replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]);

/** A false feature is unavailable and must not be advertised on public plan cards. */
export const isPlanFeatureEnabled = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized !== "false" && normalized !== "0" && normalized !== "no";
};

/**
 * Public pricing cards show the Persian capability name, never implementation
 * values such as `true`, or an internal key.
 */
export const getPlanFeatureLabel = (feature: PlanFeatureDto) => {
  const key = feature.key.trim().toLowerCase();
  const value = feature.value.trim().toLowerCase();
  const unit = QUOTA_UNITS[key];

  if (unit) {
    if (value === "unlimited" || value === "-1") return `${unit} نامحدود`;
    if (/^\d+$/.test(value)) return `تا ${toFa(value)} ${unit}`;
    return unit;
  }

  return FEATURE_LABELS[key] ?? feature.key.replace(/[_.-]+/g, " ");
};

export const visiblePlanFeatureLabels = (features: PlanFeatureDto[]) =>
  features
    .filter((feature) => isPlanFeatureEnabled(feature.value))
    .map(getPlanFeatureLabel);
