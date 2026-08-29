import { jsx as _jsx } from "react/jsx-runtime";
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
        return _jsx("div", { className: "h-9 w-36 animate-pulse rounded-lg bg-bg-elevated" });
    }
    if (isError || brands.length === 0) {
        return (_jsx("select", { value: "all", disabled: true, className: "h-9 rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm text-text-muted", children: _jsx("option", { value: "all", children: "All brands" }) }));
    }
    return (_jsx("select", { value: selectedBrandId ?? '', onChange: (e) => setSelectedBrand(e.target.value || null), className: "h-9 rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm text-text-primary outline-none focus:border-brand-primary", children: brands.map((brand) => (_jsx("option", { value: brand.id, children: brand.name }, brand.id))) }));
}
