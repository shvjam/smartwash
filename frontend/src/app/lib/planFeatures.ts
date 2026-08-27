import type { PlanFeatureDto } from "../api/types";

const FEATURE_LABELS: Record<string, string> = {
  max_bays: "جایگاه",
  bays: "جایگاه",
  max_users: "کاربر",
  users: "کاربر",
  workers: "پرسنل",
  max_branches: "شعبه",
  branches: "شعبه",
  max_vehicles: "خودرو / مشتری",
  vehicles: "خودرو / مشتری",
  reservations: "رزرو آنلاین",
  sms: "پیامک",
  loyalty: "باشگاه مشتریان",
  campaigns: "کمپین‌های بازاریابی",
  wallet: "کیف پول",
  branding: "برندینگ سفارشی",
  reports: "گزارش‌ها",
  support: "پشتیبانی",
  multibranch: "مدیریت چندشعبه‌ای",
  roles: "نقش‌های سفارشی",
  api: "API اختصاصی",
  sla: "SLA سازمانی",
  manager: "حساب‌مدیر اختصاصی",
  "all-pro": "تمام امکانات حرفه‌ای",
};

/** A false feature is unavailable and must not be advertised on public plan cards. */
export const isPlanFeatureEnabled = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized !== "false" && normalized !== "0" && normalized !== "no";
};

/**
 * Public pricing cards show the Persian capability name, never implementation
 * values such as `true`, `unlimited`, or an internal numeric quota.
 */
export const getPlanFeatureLabel = (feature: PlanFeatureDto) =>
  FEATURE_LABELS[feature.key.trim().toLowerCase()] ?? feature.key.replace(/[_-]+/g, " ");

export const visiblePlanFeatureLabels = (features: PlanFeatureDto[]) =>
  features
    .filter((feature) => isPlanFeatureEnabled(feature.value))
    .map(getPlanFeatureLabel);
