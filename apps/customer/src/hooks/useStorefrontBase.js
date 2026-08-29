import { useSessionStore } from '@/stores/session';
export function useStorefrontBase() {
    const organizationSlug = useSessionStore((s) => s.organizationSlug);
    const outletSlug = useSessionStore((s) => s.outletSlug);
    if (organizationSlug && outletSlug) {
        return `/${organizationSlug}/${outletSlug}`;
    }
    return '/';
}
