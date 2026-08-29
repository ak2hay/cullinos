import { useSessionStore } from '@/stores/session';

export function useStorefrontBase(): string {
  const organizationSlug = useSessionStore((s) => s.organizationSlug);
  const outletSlug = useSessionStore((s) => s.outletSlug);
  if (organizationSlug && outletSlug) {
    return `/${organizationSlug}/${outletSlug}`;
  }
  return '/';
}
