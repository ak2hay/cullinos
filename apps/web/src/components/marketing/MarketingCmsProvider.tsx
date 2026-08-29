'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { MarketingCmsBundle } from '@cullinos/shared';
import { fetchMarketingBundle } from '@/lib/marketing-content';

const MarketingCmsContext = createContext<MarketingCmsBundle | null>(null);

export function MarketingCmsProvider({
  initialData,
  children,
}: {
  initialData: MarketingCmsBundle;
  children: React.ReactNode;
}) {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preview = params.get('preview');
    if (!preview) return;
    fetchMarketingBundle(preview).then((draft) => {
      if (draft) setData(draft);
    });
  }, []);

  const value = useMemo(() => data, [data]);
  return <MarketingCmsContext.Provider value={value}>{children}</MarketingCmsContext.Provider>;
}

export function useMarketingCms() {
  const ctx = useContext(MarketingCmsContext);
  if (!ctx) throw new Error('useMarketingCms must be used within MarketingCmsProvider');
  return ctx;
}
