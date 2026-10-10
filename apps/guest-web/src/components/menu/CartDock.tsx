import { formatPrice } from '@/lib/api';
import { ArrowRightIcon, CartIcon } from './icons';

interface CartDockProps {
  itemCount: number;
  /** Paise */
  total: number;
  onOpen: () => void;
}

export function CartDock({ itemCount, total, onOpen }: CartDockProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-[22px] bg-qr-ink p-2 pl-4 text-white shadow-lg">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="relative">
            <CartIcon size={26} />
            <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-qr-yellow px-1 text-[11px] font-bold text-qr-ink">
              {itemCount}
            </span>
          </span>
          <span className="min-w-0">
            <span className="block font-display text-base font-bold leading-tight">View Cart</span>
            <span className="block truncate text-xs text-white/60">
              {itemCount} {itemCount === 1 ? 'item' : 'items'} • {formatPrice(total)}
            </span>
          </span>
        </button>
        <span aria-hidden className="h-9 w-px bg-white/15" />
        <button
          type="button"
          onClick={onOpen}
          className="flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-qr-yellow px-5 font-display text-[15px] font-bold text-qr-ink transition-transform active:scale-[0.98]"
        >
          Place Order
          <ArrowRightIcon size={18} />
        </button>
      </div>
    </div>
  );
}
