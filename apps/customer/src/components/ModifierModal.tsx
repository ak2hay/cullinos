import { useEffect, useState } from 'react';
import type { MenuItem } from '@/lib/api';
import { formatPrice } from '@/lib/api';
import { Button } from './ui/Form';

export interface ModifierSelection {
  id: string;
  name: string;
  price: number;
}

interface ModifierModalProps {
  item: MenuItem | null;
  open: boolean;
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

export function ModifierModal({ item, open, onClose, onAdd }: ModifierModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>();
  const [selectedModifiers, setSelectedModifiers] = useState<ModifierSelection[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (item) {
      setQuantity(1);
      setSelectedVariantId(item.variants?.[0]?.id);
      setSelectedModifiers([]);
      setNotes('');
    }
  }, [item]);

  if (!open || !item) return null;

  const variant = item.variants?.find((v) => v.id === selectedVariantId);
  const unitPrice = variant?.price ?? item.price;
  const modTotal = selectedModifiers.reduce((s, m) => s + m.price, 0);
  const lineTotal = (unitPrice + modTotal) * quantity;

  function toggleModifier(mod: ModifierSelection, groupMax: number, groupSelected: number) {
    const exists = selectedModifiers.some((m) => m.id === mod.id);
    if (exists) {
      setSelectedModifiers((prev) => prev.filter((m) => m.id !== mod.id));
    } else if (groupSelected < groupMax) {
      setSelectedModifiers((prev) => [...prev, mod]);
    }
  }

  function handleAdd() {
    onAdd({
      quantity,
      variantId: variant?.id,
      variantName: variant?.name,
      unitPrice,
      modifiers: selectedModifiers,
      notes: notes.trim() || undefined,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-bg-secondary p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{item.name}</h2>
            {item.description ? (
              <p className="mt-1 text-sm text-text-secondary">{item.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        {item.variants && item.variants.length > 0 ? (
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium text-text-secondary">Size</p>
            <div className="flex flex-wrap gap-2">
              {item.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVariantId(v.id)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    selectedVariantId === v.id
                      ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                      : 'border-white/10 bg-bg-card'
                  }`}
                >
                  {v.name} · {formatPrice(v.price)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {item.modifierGroups?.map((group) => {
          const groupSelected = selectedModifiers.filter((m) =>
            group.modifiers.some((gm) => gm.id === m.id),
          ).length;

          return (
            <div key={group.id} className="mb-4">
              <p className="mb-2 text-sm font-medium text-text-secondary">
                {group.name}
                {group.minSelect > 0 ? (
                  <span className="text-text-muted"> · pick {group.minSelect}</span>
                ) : null}
              </p>
              <div className="space-y-2">
                {group.modifiers.map((mod) => {
                  const selected = selectedModifiers.some((m) => m.id === mod.id);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() =>
                        toggleModifier(
                          { id: mod.id, name: mod.name, price: mod.price },
                          group.maxSelect,
                          groupSelected,
                        )
                      }
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                        selected
                          ? 'border-brand-primary bg-brand-primary/10'
                          : 'border-white/10 bg-bg-card'
                      }`}
                    >
                      <span>{mod.name}</span>
                      {mod.price > 0 ? (
                        <span className="text-brand-primary">+{formatPrice(mod.price)}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="mb-4">
          <label htmlFor="item-notes" className="mb-2 block text-sm font-medium text-text-secondary">
            Special instructions
          </label>
          <textarea
            id="item-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm outline-none focus:border-brand-primary"
            placeholder="No onions, extra spicy…"
          />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-card text-lg"
            >
              −
            </button>
            <span className="w-6 text-center font-medium">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-card text-lg"
            >
              +
            </button>
          </div>
          <span className="text-lg font-semibold text-brand-primary">{formatPrice(lineTotal)}</span>
        </div>

        <Button className="w-full" onClick={handleAdd}>
          Add to cart
        </Button>
      </div>
    </div>
  );
}
