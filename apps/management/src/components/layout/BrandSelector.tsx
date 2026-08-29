import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { brandsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export function BrandSelector() {
  const selectedBrandId = useAuthStore((s) => s.selectedBrandId);
  const setSelectedBrand = useAuthStore((s) => s.setSelectedBrand);

  const { data: brands = [], isLoading, isError } = useQuery({
    queryKey: ['brands'],
    queryFn: brandsApi.list,
    retry: false,
  });

  useEffect(() => {
    if (!selectedBrandId && brands.length > 0) {
      setSelectedBrand(brands[0].id);
    }
  }, [brands, selectedBrandId, setSelectedBrand]);

  if (isLoading) {
    return <div className="h-9 w-36 animate-pulse rounded-lg bg-bg-elevated" />;
  }

  if (isError || brands.length === 0) {
    return (
      <select
        value="all"
        disabled
        className="h-9 rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm text-text-muted"
      >
        <option value="all">All brands</option>
      </select>
    );
  }

  return (
    <select
      value={selectedBrandId ?? ''}
      onChange={(e) => setSelectedBrand(e.target.value || null)}
      className="h-9 rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm text-text-primary outline-none focus:border-brand-primary"
    >
      {brands.map((brand) => (
        <option key={brand.id} value={brand.id}>
          {brand.name}
        </option>
      ))}
    </select>
  );
}
