export const API_CONFIG = {
  baseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'https://api.appsmartwash.com',
  tenantSlugStorageKey: 'sw_tenant_slug',
  accessTokenStorageKey: 'sw_access',
  refreshTokenStorageKey: 'sw_refresh',
  userStorageKey: 'sw_user',
};

export const tenantSlug = {
  get: () => localStorage.getItem(API_CONFIG.tenantSlugStorageKey) || '',
  set: (slug: string) => localStorage.setItem(API_CONFIG.tenantSlugStorageKey, slug),
  clear: () => localStorage.removeItem(API_CONFIG.tenantSlugStorageKey),
};
