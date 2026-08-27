import React, { createContext, useContext, useMemo } from 'react';
import { auth } from '../api';
import { useCarWash } from '../store';

type RbacContextValue = {
  permissions: Set<string>;
  isPlatformAdmin: boolean;
};

const RbacContext = createContext<RbacContextValue | null>(null);

export const RbacProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // RbacProvider is mounted inside CarWashProvider, so useCarWash() is safe here.
  // Depending on user from store means RBAC re-evaluates on login/logout/role change.
  const { user } = useCarWash();

  const value = useMemo<RbacContextValue>(() => {
    // Prefer live store.user; on first render before auth completes, fall back to localStorage
    const stored = auth.getUser();
    const perms: string[] = user?.permissions ?? stored?.permissions ?? [];
    const isAdmin: boolean = user?.isPlatformAdmin ?? !!stored?.isPlatformAdmin;
    return {
      permissions: new Set<string>(perms),
      isPlatformAdmin: isAdmin,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, user?.isPlatformAdmin, (user?.permissions ?? []).join(',')]);

  return <RbacContext.Provider value={value}>{children}</RbacContext.Provider>;
};

const useRbac = () => useContext(RbacContext);

const matches = (perms: Set<string>, key: string): boolean => {
  if (perms.has(key)) return true;
  if (key.endsWith('.*')) {
    const prefix = key.slice(0, -1);
    for (const p of perms) if (p.startsWith(prefix)) return true;
    return false;
  }
  const parts = key.split('.');
  for (let i = parts.length - 1; i >= 1; i--) {
    const wc = [...parts.slice(0, i), '*'].join('.');
    if (perms.has(wc)) return true;
  }
  return false;
};

export const useCan = (permission?: string | string[]): boolean => {
  const ctx = useRbac();
  if (!ctx) return true;
  if (ctx.isPlatformAdmin) return true;
  if (!permission) return true;
  const keys = Array.isArray(permission) ? permission : [permission];
  return keys.some(k => matches(ctx.permissions, k));
};

export const usePermissionCheck = (): ((permission?: string | string[]) => boolean) => {
  const ctx = useRbac();
  return (permission?: string | string[]) => {
    if (!ctx) return true;
    if (ctx.isPlatformAdmin) return true;
    if (!permission) return true;
    const keys = Array.isArray(permission) ? permission : [permission];
    return keys.some(k => matches(ctx.permissions, k));
  };
};

export const Can: React.FC<{ permission?: string | string[]; fallback?: React.ReactNode; children: React.ReactNode }> =
  ({ permission, fallback = null, children }) => {
    const ok = useCan(permission);
    return <>{ok ? children : fallback}</>;
  };
