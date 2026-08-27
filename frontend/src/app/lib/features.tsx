import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { featuresApi, type FeatureMap, ApiException } from '../api';
import { useCarWash } from '../store';

type Ctx = {
  features: FeatureMap;
  loading: boolean;
  has: (key: string) => boolean;
  limit: (key: string) => number | null;
  reload: () => Promise<void>;
};

const FeaturesContext = createContext<Ctx | undefined>(undefined);

const truthy = (v: string | undefined) => {
  if (v === undefined) return false;
  if (v === '') return true;
  const s = v.toLowerCase();
  if (s === 'false' || s === '0') return false;
  return true;
};

const toLimit = (v: string | undefined): number | null => {
  if (v === undefined) return null;
  if (v === 'unlimited' || v === '-1') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

export const FeaturesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useCarWash();
  const [features, setFeatures] = useState<FeatureMap>({});
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!user || user.isPlatformAdmin || !user.tenantId) { setFeatures({}); return; }
    setLoading(true);
    try {
      const map = await featuresApi.list();
      setFeatures(map || {});
    } catch (e) {
      if (!(e instanceof ApiException)) console.error(e);
      setFeatures({});
    } finally { setLoading(false); }
  }, [user?.userId, user?.tenantId, user?.isPlatformAdmin]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <FeaturesContext.Provider value={{
      features, loading,
      has: (k) => truthy(features[k]),
      limit: (k) => toLimit(features[k]),
      reload,
    }}>
      {children}
    </FeaturesContext.Provider>
  );
};

export const useFeatures = () => {
  const ctx = useContext(FeaturesContext);
  if (!ctx) throw new Error('useFeatures must be used within FeaturesProvider');
  return ctx;
};

export const useFeature = (key: string) => {
  const { has, loading } = useFeatures();
  return { enabled: has(key), loading };
};
