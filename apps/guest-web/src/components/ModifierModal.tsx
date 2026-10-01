import { useEffect, useState } from 'react';
import { formatPrice, type MenuItem } from '@/lib/api';

export interface ModifierSelection {
  id: string;
  name: string;
  price: number;
}

interface ModifierModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (payload: {
    quantity: number;
    variantId?: string;
    variantName?: string;
    unitPrice: number;
    modifiers: ModifierSelection[];
    notes?: string;
  }) => void;
}

export function ModifierModal({ item, onClose, onAdd }: ModifierModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState<string | undefined>();
  const [modifiers, setModifiers] = useState<ModifierSelection[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (item) {
      setQuantity(1);
      setVariantId(item.variants?.[0]?.id);
      setModifiers([]);
      setNotes('');
    }
  }, [item]);

  if (!item) return null;

  const variant = item.variants?.find((v) => v.id === variantId);
  const unitPrice = variant?.price ?? item.price;
  const modTotal = modifiers.reduce((s, m) => s + m.price, 0);
  const lineTotal = (unitPrice + modTotal) * quantity;

  const unmetGroup = item.modifierGroups?.find((group) => {
    const picked = modifiers.filter((m) => group.modifiers.some((gm) => gm.id === m.id)).length;
    return picked < group.minSelect;
  });

  function toggle(mod: ModifierSelection, groupMax: number, groupSelected: number) {
    if (modifiers.some((m) => m.id === mod.id)) {
      setModifiers((prev) => prev.filter((m) => m.id !== mod.id));
    } else if (groupSelected < groupMax || groupMax <= 0) {
      setModifiers((prev) => [...prev, mod]);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-bg-secondary"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-subtle p-5">
          <div>
            <h2 className="font-display text-xl font-bold">{item.name}</h2>
            {item.description ? (
              <p className="mt-1 text-sm text-text-secondary">{item.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-card text-lg text-text-muted"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {item.variants && item.variants.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-semibold text-text-secondary">Choose size</p>
              <div className="grid grid-cols-2 gap-2">
                {item.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold ${
                      variantId === v.id
                        ? 'border-brand-primary bg-brand-primary/15 text-brand-primary'
                        : 'border-line bg-bg-card'
                    }`}
                  >
                    {v.name}
                    <span className="mt-1 block font-mono text-xs">{formatPrice(v.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {item.modifierGroups?.map((group) => {
            const groupSelected = modifiers.filter((m) =>
              group.modifiers.some((gm) => gm.id === m.id),
            ).length;
            return (
              <div key={group.id}>
                <p className="mb-2 text-sm font-semibold text-text-secondary">
                  {group.name}
                  {group.minSelect > 0 ? (
                    <span className="font-normal text-text-muted"> · pick {group.minSelect}</span>
                  ) : null}
                </p>
                <div className="space-y-2">
                  {group.modifiers.map((mod) => {
                    const selected = modifiers.some((m) => m.id === mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() =>
                          toggle(
                            { id: mod.id, name: mod.name, price: mod.price },
                            group.maxSelect,
                            groupSelected,
                          )
                        }
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-sm ${
                          selected ? 'border-brand-primary bg-brand-primary/10' : 'border-line bg-bg-card'
                        }`}
                      >
                        <span>{mod.name}</span>
                        {mod.price > 0 ? (
                          <span className="font-mono text-brand-primary">+{formatPrice(mod.price)}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div>
            <label htmlFor="item-notes" className="mb-2 block text-sm font-semibold text-text-secondary">
              Special instructions
            </label>
            <textarea
              id="item-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-line bg-bg-card px-3 py-2 text-sm outline-none focus:border-brand-primary"
              placeholder="No onions, extra spicy…"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-line-subtle p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg-card text-xl"
            >
              −
            </button>
            <span className="w-6 text-center font-mono">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary/20 text-xl text-brand-primary"
            >
              +
            </button>
          </div>
          <button
            type="button"
            disabled={Boolean(unmetGroup)}
            onClick={() => {
              onAdd({
                quantity,
                variantId: variant?.id,
                variantName: variant?.name,
                unitPrice,
                modifiers,
                notes: notes.trim() || undefined,
              });
            }}
            className="flex h-12 flex-1 items-center justify-between rounded-xl bg-brand-primary px-4 text-sm font-bold text-on-brand disabled:opacity-40"
          >
            <span>{unmetGroup ? `Pick ${unmetGroup.name}` : 'Add to order'}</span>
            <span className="font-mono">{formatPrice(lineTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
