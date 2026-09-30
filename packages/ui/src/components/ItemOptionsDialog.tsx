import { useEffect, useMemo, useState } from 'react';
import { Dialog } from './Dialog';
import { cn } from '../utils';

export interface ItemOptionsVariant {
  id: string;
  name: string;
  /** Paise */
  price: number;
}

export interface ItemOptionsModifier {
  id: string;
  name: string;
  /** Paise */
  price: number;
}

export interface ItemOptionsGroup {
  id: string;
  name: string;
  minSelect?: number | null;
  maxSelect?: number | null;
  modifiers: ItemOptionsModifier[];
}

export interface ItemOptionsItem {
  id: string;
  name: string;
  /** Paise */
  price: number;
  variants?: ItemOptionsVariant[];
  modifierGroups?: ItemOptionsGroup[];
}

export interface ItemOptionsSelection {
  menuItemId: string;
  name: string;
  /** Paise, variant (or base) price plus modifiers */
  unitPrice: number;
  variantId?: string;
  modifiers: Array<{ modifierId: string; name: string; price: number }>;
}

export interface ItemOptionsDialogProps {
  item: ItemOptionsItem | null;
  onClose: () => void;
  onConfirm: (selection: ItemOptionsSelection) => void;
  formatMoney: (paise: number) => string;
}

export function itemNeedsOptions(item: ItemOptionsItem): boolean {
  return Boolean(
    item.variants?.length || item.modifierGroups?.some((g) => g.modifiers.length > 0),
  );
}

export function ItemOptionsDialog({ item, onClose, onConfirm, formatMoney }: ItemOptionsDialogProps) {
  const [variantId, setVariantId] = useState<string | undefined>();
  const [picked, setPicked] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setVariantId(item?.variants?.[0]?.id);
    setPicked({});
  }, [item]);

  const groups = useMemo(
    () => (item?.modifierGroups ?? []).filter((g) => g.modifiers.length > 0),
    [item],
  );

  if (!item) return null;

  const variant = item.variants?.find((v) => v.id === variantId);
  const chosenModifiers = groups.flatMap((g) =>
    (picked[g.id] ?? [])
      .map((id) => g.modifiers.find((m) => m.id === id))
      .filter((m): m is ItemOptionsModifier => Boolean(m)),
  );
  const unitPrice =
    (variant?.price ?? item.price) + chosenModifiers.reduce((sum, m) => sum + m.price, 0);

  const unmet = groups.find((g) => (picked[g.id]?.length ?? 0) < (g.minSelect ?? 0));
  const missingVariant = Boolean(item.variants?.length) && !variant;

  function toggle(group: ItemOptionsGroup, modifierId: string) {
    setPicked((prev) => {
      const current = prev[group.id] ?? [];
      const max = group.maxSelect && group.maxSelect > 0 ? group.maxSelect : Infinity;
      if (current.includes(modifierId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== modifierId) };
      }
      if (max === 1) return { ...prev, [group.id]: [modifierId] };
      if (current.length >= max) return prev;
      return { ...prev, [group.id]: [...current, modifierId] };
    });
  }

  function confirm() {
    if (!item || unmet || missingVariant) return;
    const label = [
      variant ? `${item.name} (${variant.name})` : item.name,
      ...chosenModifiers.map((m) => m.name),
    ].join(' + ');
    onConfirm({
      menuItemId: item.id,
      name: label,
      unitPrice,
      ...(variant ? { variantId: variant.id } : {}),
      modifiers: chosenModifiers.map((m) => ({ modifierId: m.id, name: m.name, price: m.price })),
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={item.name}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={Boolean(unmet) || missingVariant}
            onClick={confirm}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-40"
          >
            Add · {formatMoney(unitPrice)}
          </button>
        </>
      }
    >
      <div className="max-h-[60vh] space-y-5 overflow-y-auto">
        {item.variants?.length ? (
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Size</p>
            <div className="flex flex-wrap gap-2">
              {item.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm',
                    v.id === variantId
                      ? 'border-brand-primary bg-brand-primary/15 text-brand-primary'
                      : 'border-line',
                  )}
                >
                  {v.name} · {formatMoney(v.price)}
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {groups.map((group) => {
          const selected = picked[group.id] ?? [];
          const min = group.minSelect ?? 0;
          const max = group.maxSelect && group.maxSelect > 0 ? group.maxSelect : null;
          return (
            <section key={group.id} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                {group.name}
                {min > 0 ? ` · pick at least ${min}` : ''}
                {max ? ` · up to ${max}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.modifiers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(group, m.id)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-sm',
                      selected.includes(m.id)
                        ? 'border-brand-primary bg-brand-primary/15 text-brand-primary'
                        : 'border-line',
                    )}
                  >
                    {m.name}
                    {m.price > 0 ? ` +${formatMoney(m.price)}` : ''}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Dialog>
  );
}
