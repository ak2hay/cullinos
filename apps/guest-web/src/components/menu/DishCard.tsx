import type { ReactNode } from 'react';
import { formatPrice, type MenuItem } from '@/lib/api';
import { FlameIcon, MinusIcon, PlusIcon, UtensilsIcon } from './icons';

interface DishCardProps {
  item: MenuItem;
  quantity: number;
  bestseller?: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

export function DishCard({ item, quantity, bestseller, onAdd, onRemove }: DishCardProps) {
  const discounted = item.regularPrice != null && item.regularPrice > item.price;

  return (
    <article className="flex gap-3 rounded-2xl bg-bg-card p-2.5 shadow-sm">
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Add ${item.name}`}
        className="relative h-[92px] w-[112px] shrink-0 overflow-hidden rounded-xl bg-bg-elevated"
      >
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-text-muted">
            <UtensilsIcon size={28} />
          </span>
        )}
        {bestseller ? (
          <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-qr-nonveg px-2 py-0.5 text-[10px] font-bold text-white shadow">
            <FlameIcon size={10} />
            Bestseller
          </span>
        ) : null}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-display text-[15px] font-bold leading-snug">
            {item.isVeg != null ? <VegMark veg={Boolean(item.isVeg)} /> : null}
            <span className="truncate">{item.name}</span>
          </h3>
          {item.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-text-muted">{item.description}</p>
          ) : null}
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="font-display text-base font-extrabold text-qr-yellow-deep">
              {formatPrice(item.price)}
            </span>
            {discounted ? (
              <span className="text-xs text-text-muted line-through">{formatPrice(item.regularPrice!)}</span>
            ) : null}
          </p>
        </div>

        {quantity > 0 ? (
          <div className="flex shrink-0 flex-col items-center gap-1 rounded-xl bg-qr-yellow-soft p-1">
            <StepButton label={`Add one ${item.name}`} onClick={onAdd}>
              <PlusIcon size={16} />
            </StepButton>
            <span className="font-display text-sm font-bold text-qr-ink">{quantity}</span>
            <StepButton label={`Remove one ${item.name}`} onClick={onRemove}>
              <MinusIcon size={16} />
            </StepButton>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Add ${item.name}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-qr-yellow-soft text-qr-yellow-deep transition-transform active:scale-95"
          >
            <PlusIcon size={22} strokeWidth={2.4} />
          </button>
        )}
      </div>
    </article>
  );
}

export function VegMark({ veg }: { veg: boolean }) {
  return (
    <span
      role="img"
      aria-label={veg ? 'Vegetarian' : 'Non-vegetarian'}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-2 ${
        veg ? 'border-qr-veg' : 'border-qr-nonveg'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${veg ? 'bg-qr-veg' : 'bg-qr-nonveg'}`} />
    </span>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-qr-yellow-deep shadow-sm"
    >
      {children}
    </button>
  );
}
