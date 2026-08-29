import { CULLINOS_BRAND } from '@/lib/api';

export function PoweredByFooter() {
  return (
    <footer className="border-t border-white/10 py-4 text-center">
      <p className="text-xs text-text-muted">
        {CULLINOS_BRAND.poweredBy}
      </p>
    </footer>
  );
}
