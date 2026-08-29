import { useQuery } from '@tanstack/react-query';
import { couponsApi, loyaltyApi } from '@/lib/api';

export function CustomersPage() {
  const tiersQuery = useQuery({ queryKey: ['loyalty'], queryFn: loyaltyApi.listTiers });
  const couponsQuery = useQuery({ queryKey: ['coupons'], queryFn: couponsApi.list });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">CRM & Loyalty</h1>
        <p className="text-sm text-text-secondary">Stamp-card loyalty, tiers, and coupon campaigns.</p>
      </div>

      <section className="rounded-xl border border-white/5 bg-bg-card p-4">
        <h2 className="font-semibold">Loyalty tiers</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(tiersQuery.data ?? []).map((tier) => (
            <li key={String(tier.id)} className="text-text-secondary">
              {String(tier.name)} — min {String(tier.minPoints)} pts
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-text-muted">
          Cafe stamp cards: 10 stamps = free drink (100 loyalty points). Use POS or admin to add stamps per customer.
        </p>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-4">
        <h2 className="font-semibold">Active coupons</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(couponsQuery.data ?? []).map((coupon) => (
            <li key={String(coupon.id)} className="text-text-secondary">
              <span className="font-mono text-brand-primary">{String(coupon.code)}</span>
              {' — '}
              {String(coupon.type)} {String(coupon.value)}
              {coupon.isActive === false ? ' (inactive)' : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
