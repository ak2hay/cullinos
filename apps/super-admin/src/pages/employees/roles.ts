import type { PlatformRole } from '@/lib/permissions';

export const ROLE_ORDER: PlatformRole[] = ['owner', 'support', 'sales', 'marketing', 'finance', 'viewer'];

export const ROLE_SUMMARY: Record<PlatformRole, string> = {
  owner: 'Everything, including team, settings, Labs SQL and tenant delete.',
  support: 'Tenants (read, suspend, open as tenant), tenant user resets, App Ops, audit.',
  sales: 'Tenants (read, onboard), subscriptions, plans (read), marketing inquiries.',
  marketing: 'Marketing CMS, inquiries, promo email, App Ops.',
  finance: 'Plans, subscriptions, tenant wallets, audit.',
  viewer: 'Read-only dashboard, tenants, plans, audit and health.',
};
