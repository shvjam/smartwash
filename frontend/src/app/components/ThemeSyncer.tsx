import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useCarWash } from '../store';
import { settingsApi } from '../api';

export const ThemeSyncer = () => {
  const { user } = useCarWash();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!user) return;
    let alive = true;
    settingsApi.get()
      .then(s => {
        if (!alive) return;
        const t = s.theme;
        if (t === 'dark' || t === 'light') setTheme(t);
        else setTheme('system');
      })
      .catch(() => { });
    return () => { alive = false; };
  }, [user?.tenantId]);

  return null;
};
