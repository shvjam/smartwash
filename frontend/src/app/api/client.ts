import { toast } from 'sonner';
import { API_CONFIG, tenantSlug } from './config';
import type { ApiError, AuthResponse, AuthSession } from './types';

// Convert the backend's nested auth response into the flat session shape the app uses.
// isPlatformAdmin is derived from roles (platform:* roles) since the backend doesn't send it.
function normalizeAuth(raw: AuthResponse): AuthSession {
  const u = raw?.user ?? ({} as AuthResponse['user']);
  const roles = u.roles ?? [];
  return {
    accessToken: raw.accessToken,
    refreshToken: raw.refreshToken,
    userId: u.id,
    email: u.email,
    displayName: u.displayName,
    tenantId: u.tenantId ?? null,
    tenantSlug: u.tenantSlug ?? null,
    roles,
    permissions: u.permissions ?? [],
    isPlatformAdmin: roles.some(r => r.startsWith('platform:')),
  };
}

type AnyJson = unknown;

export class ApiException extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message); this.status = status; this.code = code;
  }
}

const tokens = {
  access: () => localStorage.getItem(API_CONFIG.accessTokenStorageKey),
  refresh: () => localStorage.getItem(API_CONFIG.refreshTokenStorageKey),
  set: (a: string, r: string) => {
    localStorage.setItem(API_CONFIG.accessTokenStorageKey, a);
    localStorage.setItem(API_CONFIG.refreshTokenStorageKey, r);
  },
  clear: () => {
    localStorage.removeItem(API_CONFIG.accessTokenStorageKey);
    localStorage.removeItem(API_CONFIG.refreshTokenStorageKey);
    localStorage.removeItem(API_CONFIG.userStorageKey);
  },
};

export const auth = {
  access: tokens.access,
  refresh: tokens.refresh,
  setSession(resp: AuthResponse): AuthSession {
    const s = normalizeAuth(resp);
    tokens.set(s.accessToken, s.refreshToken);
    localStorage.setItem(API_CONFIG.userStorageKey, JSON.stringify({
      userId: s.userId, email: s.email, displayName: s.displayName,
      tenantId: s.tenantId, tenantSlug: s.tenantSlug,
      roles: s.roles, permissions: s.permissions, isPlatformAdmin: s.isPlatformAdmin,
    }));
    if (s.tenantSlug) tenantSlug.set(s.tenantSlug);
    return s;
  },
  getUser() {
    try { const raw = localStorage.getItem(API_CONFIG.userStorageKey); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  },
  /**
   * به‌روزرسانی بخشی از نشستِ ذخیره‌شده — برای تازه‌سازی نقش‌ها و مجوزها از /me
   * بدون نیاز به ورود مجدد. اگر مجوز جدیدی به نقش کاربر اضافه شود، همین‌جا اعمال می‌شود.
   */
  mergeUser(patch: Partial<Pick<AuthSession, 'roles' | 'permissions' | 'isPlatformAdmin' | 'tenantId'>>) {
    const current = auth.getUser();
    if (!current) return null;
    const next = { ...current, ...patch };
    localStorage.setItem(API_CONFIG.userStorageKey, JSON.stringify(next));
    return next;
  },
  clear() { tokens.clear(); tenantSlug.clear(); },
};

type Scope = 'tenant' | 'platform' | 'public' | 'cron';
type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: AnyJson;
  query?: Record<string, string | number | boolean | null | undefined>;
  scope?: Scope;
  signal?: AbortSignal;
};

function buildUrl(path: string, scope: Scope, query?: RequestOptions['query']) {
  let prefix = '';
  if (scope === 'tenant') {
    const slug = tenantSlug.get();
    if (!slug) throw new ApiException(400, 'Tenant.SlugMissing', 'نامک مستاجر تنظیم نشده است.');
    prefix = `/api/t/${encodeURIComponent(slug)}`;
  } else if (scope === 'platform') prefix = '/api/platform';
  else if (scope === 'public') prefix = '/api/public';
  else prefix = '/api/cron';

  const url = new URL(API_CONFIG.baseUrl + prefix + (path.startsWith('/') ? path : `/${path}`));
  if (query) for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined || v === '') continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

let refreshInFlight: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const rt = tokens.refresh();
  if (!rt) return false;
  refreshInFlight = (async () => {
    try {
      const resp = await fetch(`${API_CONFIG.baseUrl}/api/public/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!resp.ok) { auth.clear(); return false; }
      const data: AuthResponse = await resp.json();
      auth.setSession(data);
      return true;
    } catch { auth.clear(); return false; }
    finally { refreshInFlight = null; }
  })();
  return refreshInFlight;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const scope = opts.scope ?? 'tenant';
  const url = buildUrl(path, scope, opts.query);
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  if (opts.body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';
  const at = tokens.access();
  if (at) headers['Authorization'] = `Bearer ${at}`;

  const doFetch = () => fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? (isFormData ? opts.body as BodyInit : JSON.stringify(opts.body)) : undefined,
    signal: opts.signal,
  });

  let resp = await doFetch();
  // حتی اگر access token نداشتیم ولی refresh token معتبر داریم، تلاش برای تازه‌سازی کن
  if (resp.status === 401 && scope !== 'public' && tokens.refresh()) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${tokens.access()}`;
      resp = await doFetch();
    }
  }

  if (resp.status === 204) return undefined as T;
  const text = await resp.text();
  const data = text ? safeParse(text) : null;
  if (!resp.ok) {
    const err = parseError(resp.status, resp.statusText, data);
    // بازخوردِ سراسری وقتی نوشتن به‌خاطرِ وضعیتِ اشتراک مسدود می‌شود (دوره مهلت/تعلیق/انقضا)
    // تا در همه‌ی صفحات بدون تغییرِ تک‌تکِ آن‌ها، کاربر پیام روشن ببیند.
    if (err.status === 403 && (err.code === 'Tenant.ReadOnly' || err.code === 'Tenant.Inactive')) {
      toast.error(err.message);
    }
    throw err;
  }
  return data as T;
}

// Parses both error shapes the backend can return:
//  - Result.Failure  → { code, message }           (business errors, e.g. login)
//  - ProblemDetails   → { title, detail }            (thrown exceptions, e.g. 500, 404)
//  - ValidationProblemDetails → { title, detail, errors: { field: [msgs] } }  (422 validation)
function parseError(status: number, statusText: string, data: AnyJson): ApiException {
  const d = (data ?? {}) as Record<string, unknown>;
  const code = (d.code as string) || (d.title as string) || `HTTP_${status}`;

  // ValidationProblemDetails: flatten field errors into one readable message
  const errors = d.errors as Record<string, string[]> | undefined;
  if (errors && typeof errors === 'object') {
    const msgs = Object.values(errors).flat().filter(Boolean);
    if (msgs.length) return new ApiException(status, code, msgs.join(' • '));
  }

  const message =
    (d.message as string) ||
    (d.detail as string) ||
    (d.title as string) ||
    statusText ||
    'خطای ناشناخته';
  return new ApiException(status, code, message);
}

function safeParse(t: string): unknown { try { return JSON.parse(t); } catch { return t; } }

export const api = {
  get:    <T>(path: string, query?: RequestOptions['query'], scope?: Scope) => request<T>(path, { method: 'GET', query, scope }),
  post:   <T>(path: string, body?: AnyJson, scope?: Scope) => request<T>(path, { method: 'POST', body, scope }),
  put:    <T>(path: string, body?: AnyJson, scope?: Scope) => request<T>(path, { method: 'PUT', body, scope }),
  patch:  <T>(path: string, body?: AnyJson, scope?: Scope) => request<T>(path, { method: 'PATCH', body, scope }),
  delete: <T>(path: string, scope?: Scope) => request<T>(path, { method: 'DELETE', scope }),
};
