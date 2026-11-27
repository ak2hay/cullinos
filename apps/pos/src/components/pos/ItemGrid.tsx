import { useRef, useState } from 'react';

const CATEGORY_COLORS = [
  '#9a3412',
  '#0f766e',
  '#6d28d9',
  '#1d4ed8',
  '#be123c',
  '#a16207',
  '#0e7490',
  '#4c1d95',
];

export interface GridItem {
  id: string;
  name: string;
  price: number;
  /** Set during happy hour when `price` is discounted */
  regularPrice?: number;
  isAvailable: boolean;
  imageUrl?: string | null;
  isVeg?: boolean | null;
  categoryId?: string;
  customizable?: boolean;
}

interface ItemGridProps {
  items: GridItem[];
  quantities?: Record<string, number>;
  onAdd: (item: { id: string; name: string; price: number }) => void;
  onCustomize?: (item: GridItem) => void;
  showPhotos?: boolean;
  emptyHint?: string;
}

function categoryColor(id: string | undefined): string {
  if (!id) return CATEGORY_COLORS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
  return letters || '?';
}

function ItemPhoto({
  name,
  imageUrl,
  categoryId,
  unavailable,
}: {
  name: string;
  imageUrl?: string | null;
  categoryId?: string;
  unavailable?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !failed;
  return (
    <div
      className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl"
      style={{ backgroundColor: categoryColor(categoryId) }}
    >
      <span className="absolute inset-0 flex items-center justify-center font-mono text-2xl font-bold tracking-wide text-white/90">
        {initials(name)}
      </span>
      {showImage ? (
        <img
          src={imageUrl!}
          alt=""
          width={320}
          height={240}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={`absolute inset-0 h-full w-full object-cover ${unavailable ? 'grayscale' : ''}`}
          onError={() => setFailed(true)}
        />
      ) : null}
      {unavailable ? (
        <span className="absolute bottom-2 left-2 rounded-lg bg-neutral-950/80 px-2 py-1 text-xs font-semibold text-white">
          Out of stock
        </span>
      ) : null}
    </div>
  );
}

function PriceRow({ item }: { item: GridItem }) {
  return (
    <span className="mt-2 flex items-center gap-2">
      <span className="rounded-lg bg-brand-primary/15 px-2.5 py-1 font-mono text-sm font-semibold text-brand-primary">
        ₹{(item.price / 100).toFixed(0)}
      </span>
      {item.regularPrice != null && item.regularPrice > item.price ? (
        <span className="font-mono text-xs text-text-muted line-through">
          ₹{(item.regularPrice / 100).toFixed(0)}
        </span>
      ) : null}
    </span>
  );
}

function VegMark({ isVeg }: { isVeg?: boolean | null }) {
  if (isVeg == null) return null;
  return (
    <span
      aria-label={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
      className={`inline-block h-3 w-3 shrink-0 rounded-sm border-2 align-middle ${
        isVeg ? 'border-green-500 bg-green-500/40' : 'border-red-600 bg-red-600/40'
      }`}
    />
  );
}

function ItemTile({
  item,
  qty,
  showPhotos,
  onAdd,
  onCustomize,
}: {
  item: GridItem;
  qty: number;
  showPhotos: boolean;
  onAdd: () => void;
  onCustomize?: () => void;
}) {
  const holdRef = useRef<number | null>(null);
  const suppressRef = useRef(false);

  function clearHold() {
    if (holdRef.current != null) {
      window.clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  }

  return (
    <button
      type="button"
      disabled={!item.isAvailable}
      onPointerDown={() => {
        if (!item.isAvailable || !onCustomize) return;
        suppressRef.current = false;
        clearHold();
        holdRef.current = window.setTimeout(() => {
          suppressRef.current = true;
          onCustomize();
        }, 450);
      }}
      onPointerUp={clearHold}
      onPointerLeave={clearHold}
      onPointerCancel={clearHold}
      onClick={() => {
        if (suppressRef.current) {
          suppressRef.current = false;
          return;
        }
        onAdd();
      }}
      className={`group relative flex overflow-hidden rounded-2xl border border-line bg-bg-card text-left shadow-sm transition hover:border-brand-primary/50 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed ${
        showPhotos
          ? 'min-h-[168px] flex-col'
          : 'min-h-[92px] flex-col items-start justify-between bg-gradient-to-br from-bg-card to-bg-elevated/80 p-3 sm:min-h-[112px] sm:p-4'
      }`}
    >
      {qty > 0 ? (
        <span className="absolute right-2 top-2 z-10 flex h-8 min-w-8 items-center justify-center rounded-full bg-brand-primary px-2 font-mono text-sm font-bold text-on-brand">
          {qty}
        </span>
      ) : null}
      {showPhotos ? (
        <div className="relative">
          <div className="p-2 pb-0">
            <ItemPhoto
              name={item.name}
              imageUrl={item.imageUrl}
              categoryId={item.categoryId}
              unavailable={!item.isAvailable}
            />
          </div>
        </div>
      ) : null}
      <span className={`flex min-w-0 flex-1 flex-col ${showPhotos ? 'p-3 pt-2' : ''}`}>
        <span className="flex items-start gap-1.5 pr-8">
          <VegMark isVeg={item.isVeg} />
          <span className="line-clamp-2 text-sm font-semibold leading-tight text-text-primary sm:text-base">
            {item.name}
          </span>
        </span>
        {!showPhotos && !item.isAvailable ? (
          <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Out of stock
          </span>
        ) : null}
        <PriceRow item={item} />
      </span>
    </button>
  );
}

export function ItemGrid({
  items,
  quantities = {},
  onAdd,
  onCustomize,
  showPhotos = true,
  emptyHint,
}: ItemGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-bg-card/40 p-12 text-center">
        <p className="text-base text-text-secondary">
          {emptyHint ?? 'No items in this category.'}
        </p>
        <p className="max-w-sm text-sm text-text-muted">
          Add menu items in ERP → Menu, then refresh this screen.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <ItemTile
          key={item.id}
          item={item}
          qty={quantities[item.id] ?? 0}
          showPhotos={showPhotos}
          onAdd={() => onAdd({ id: item.id, name: item.name, price: item.price })}
          onCustomize={item.customizable && item.isAvailable && onCustomize ? () => onCustomize(item) : undefined}
        />
      ))}
    </div>
  );
}
