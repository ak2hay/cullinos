import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Button, Drawer, Input, useToast } from '@cullinos/ui';
import {
  menuApi,
  type CatalogImportItem,
  type CatalogImportResult,
  type CatalogItemView,
  type CatalogSectionView,
  type CatalogStockComponent,
} from '@/lib/api';
import { formatMoney } from '@/lib/format';

const IMPORT_CHUNK = 300;
const SEARCH_LIMIT = 200;

type VegFilter = 'all' | 'veg' | 'nonveg';

interface DraftVariant {
  name: string;
  price: string;
  stockMultiplier: string;
}

interface Draft {
  name: string;
  price: string;
  isVeg: boolean;
  variants: DraftVariant[];
  trackStock: boolean;
}

interface CatalogPickerDrawerProps {
  open: boolean;
  onClose: () => void;
  onImported?: (result: CatalogImportResult) => void;
}

function rupees(paise: number): string {
  return String(Math.round(paise) / 100);
}

function toPaise(value: string): number {
  return Math.round(Number(value) * 100);
}

function draftFor(item: CatalogItemView): Draft {
  return {
    name: item.name,
    price: rupees(item.defaultPrice),
    isVeg: item.isVeg,
    variants: item.variants.map((v) => ({
      name: v.name,
      price: rupees(v.price),
      stockMultiplier: String(v.stockMultiplier),
    })),
    trackStock: item.stock.length > 0,
  };
}

function describeComponent(c: CatalogStockComponent): string {
  const pack = c.packLabel && c.packSize ? ` (1 ${c.packLabel} = ${c.packSize} ${c.unit})` : '';
  return `${c.name}: ${c.perServe} ${c.unit} per serve${pack}`;
}

function draftError(draft: Draft): string | null {
  if (!draft.name.trim()) return 'Name is required';
  if (!(Number(draft.price) >= 0) || draft.price.trim() === '') return 'Enter a price';
  for (const v of draft.variants) {
    if (!v.name.trim()) return 'Variant name is required';
    if (v.price.trim() === '' || !(Number(v.price) >= 0)) return `Enter a price for ${v.name}`;
    const m = Number(v.stockMultiplier);
    if (!(m >= 0.001 && m <= 1000)) return `Stock × for ${v.name} must be between 0.001 and 1000`;
  }
  return null;
}

function toImportItem(id: string, draft: Draft): CatalogImportItem {
  return {
    catalogItemId: id,
    name: draft.name.trim(),
    price: toPaise(draft.price),
    isVeg: draft.isVeg,
    variants: draft.variants.map((v) => ({
      name: v.name.trim(),
      price: toPaise(v.price),
      stockMultiplier: Number(v.stockMultiplier),
    })),
    trackStock: draft.trackStock,
  };
}

function VegDot({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      aria-label={isVeg ? 'Veg' : 'Non-veg'}
      title={isVeg ? 'Veg' : 'Non-veg'}
      className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
        isVeg ? 'border-green-500' : 'border-red-500'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isVeg ? 'bg-green-500' : 'bg-red-500'}`} />
    </span>
  );
}

export function CatalogPickerDrawer({ open, onClose, onImported }: CatalogPickerDrawerProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [vegFilter, setVegFilter] = useState<VegFilter>('all');
  const [showOptional, setShowOptional] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CatalogImportResult | null>(null);

  const catalogQuery = useQuery({
    queryKey: ['menu', 'catalog'],
    queryFn: () => menuApi.catalog(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const sections = catalogQuery.data?.sections ?? [];
  const coreSections = sections.filter((s) => s.visibility === 'core');
  const optionalSections = sections.filter((s) => s.visibility === 'optional');

  const coreKey = coreSections.map((s) => s.id).join(',');
  useEffect(() => {
    if (open && coreKey) setExpanded((prev) => (prev.size ? prev : new Set(coreKey.split(','))));
  }, [open, coreKey]);

  function passesVeg(item: CatalogItemView) {
    return vegFilter === 'all' || (vegFilter === 'veg' ? item.isVeg : !item.isVeg);
  }

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const out: Array<{ item: CatalogItemView; section: CatalogSectionView; subLabel: string }> = [];
    for (const section of sections) {
      for (const sub of section.subCategories) {
        for (const item of sub.items) {
          if (!passesVeg(item)) continue;
          if (`${item.name} ${section.label} ${sub.label}`.toLowerCase().includes(q)) {
            out.push({ item, section, subLabel: sub.label });
          }
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sections, vegFilter]);

  function toggleItem(item: CatalogItemView) {
    if (item.imported) return;
    setDrafts((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, draftFor(item));
      return next;
    });
  }

  function selectAll(items: CatalogItemView[], select: boolean) {
    setDrafts((prev) => {
      const next = new Map(prev);
      for (const item of items) {
        if (item.imported || !passesVeg(item)) continue;
        if (select && !next.has(item.id)) next.set(item.id, draftFor(item));
        if (!select) next.delete(item.id);
      }
      return next;
    });
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => {
      const current = prev.get(id);
      if (!current) return prev;
      const next = new Map(prev);
      next.set(id, { ...current, ...patch });
      return next;
    });
  }

  function updateVariant(id: string, idx: number, patch: Partial<DraftVariant>) {
    const draft = drafts.get(id);
    if (!draft) return;
    const variants = draft.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v));
    updateDraft(id, { variants });
  }

  function toggleSection(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      const entries = [...drafts.entries()];
      const merged: CatalogImportResult = {
        created: [],
        skipped: [],
        inventoryCreated: 0,
        recipesCreated: 0,
        warnings: [],
      };
      for (let i = 0; i < entries.length; i += IMPORT_CHUNK) {
        const chunk = entries.slice(i, i + IMPORT_CHUNK).map(([id, d]) => toImportItem(id, d));
        const result = await menuApi.importCatalog(chunk);
        merged.created.push(...result.created);
        merged.skipped.push(...result.skipped);
        merged.inventoryCreated += result.inventoryCreated;
        merged.recipesCreated += result.recipesCreated;
        for (const w of result.warnings) if (!merged.warnings.includes(w)) merged.warnings.push(w);
      }
      return merged;
    },
    onSuccess: (result) => {
      setDrafts(new Map());
      setEditingId(null);
      setLastResult(result);
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success(`Added ${result.created.length} item(s) to your menu`);
      onImported?.(result);
    },
    onError: (err: Error) => toast.error(err.message || 'Import failed'),
  });

  const firstInvalid = useMemo(() => {
    for (const [id, draft] of drafts) {
      const error = draftError(draft);
      if (error) return { id, error };
    }
    return null;
  }, [drafts]);

  function renderItem(item: CatalogItemView, context?: string) {
    const draft = drafts.get(item.id);
    const selected = Boolean(draft);
    const isEditing = selected && editingId === item.id;
    const error = draft ? draftError(draft) : null;
    return (
      <li key={item.id} className="py-2">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-brand-primary"
            checked={selected || item.imported}
            disabled={item.imported}
            onChange={() => toggleItem(item)}
            aria-label={`Select ${item.name}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <VegDot isVeg={draft ? draft.isVeg : item.isVeg} />
              <span className="font-medium">{draft?.name || item.name}</span>
              {item.imported ? (
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-text-muted">
                  On menu
                </span>
              ) : null}
            </div>
            <p className="text-xs text-text-muted">
              {context ? `${context} · ` : ''}
              {draft ? `₹${draft.price}` : formatMoney(item.defaultPrice)}
              {' · suggested '}
              {formatMoney(item.priceRange.min)}–{formatMoney(item.priceRange.max)}
              {item.variants.length ? ` · ${item.variants.map((v) => v.name).join(' / ')}` : ''}
              {item.stock.length ? ' · stock-linked' : ''}
            </p>
            {error ? <p className="text-xs text-status-error">{error}</p> : null}
          </div>
          {selected ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditingId(isEditing ? null : item.id)}
            >
              {isEditing ? 'Done' : 'Edit'}
            </Button>
          ) : null}
        </div>

        {isEditing && draft ? (
          <div className="mt-2 space-y-3 rounded-lg border border-white/10 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
              <Input
                label="Name"
                value={draft.name}
                onChange={(e) => updateDraft(item.id, { name: e.target.value })}
              />
              <Input
                label="Price (₹)"
                type="number"
                min={0}
                step="any"
                value={draft.price}
                onChange={(e) => updateDraft(item.id, { price: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-primary"
                checked={draft.isVeg}
                onChange={(e) => updateDraft(item.id, { isVeg: e.target.checked })}
              />
              Vegetarian
            </label>
            {draft.variants.length ? (
              <div className="space-y-2">
                <p className="text-xs text-text-muted">Variants · price (₹) · stock ×</p>
                {draft.variants.map((v, idx) => (
                  <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_100px_90px_auto]">
                    <Input
                      label=""
                      placeholder="Name"
                      value={v.name}
                      onChange={(e) => updateVariant(item.id, idx, { name: e.target.value })}
                    />
                    <Input
                      label=""
                      type="number"
                      min={0}
                      step="any"
                      placeholder="₹"
                      value={v.price}
                      onChange={(e) => updateVariant(item.id, idx, { price: e.target.value })}
                    />
                    <Input
                      label=""
                      type="number"
                      min={0.001}
                      step="any"
                      title="Stock multiplier: Half = 0.5, Full = 1, 60 mL on a 30 mL recipe = 2"
                      value={v.stockMultiplier}
                      onChange={(e) => updateVariant(item.id, idx, { stockMultiplier: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        updateDraft(item.id, { variants: draft.variants.filter((_, i) => i !== idx) })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            {item.stock.length ? (
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-primary"
                    checked={draft.trackStock}
                    onChange={(e) => updateDraft(item.id, { trackStock: e.target.checked })}
                  />
                  Track stock for key components
                </label>
                <ul className="ml-6 list-disc text-xs text-text-muted">
                  {item.stock.map((c) => (
                    <li key={c.key}>{describeComponent(c)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  }

  function renderSection(section: CatalogSectionView) {
    const isOpen = expanded.has(section.id);
    const selectable = section.subCategories.flatMap((s) => s.items).filter((i) => !i.imported && passesVeg(i));
    const selectedCount = selectable.filter((i) => drafts.has(i.id)).length;
    return (
      <div key={section.id} className="rounded-lg border border-white/5">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            onClick={() => toggleSection(section.id)}
            aria-expanded={isOpen}
          >
            <span aria-hidden="true" className="text-text-muted">{isOpen ? '▾' : '▸'}</span>
            <span className="font-medium">{section.label}</span>
            <span className="text-xs text-text-muted">
              {section.itemCount} items{selectedCount ? ` · ${selectedCount} selected` : ''}
            </span>
          </button>
          {isOpen && selectable.length ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => selectAll(selectable, selectedCount < selectable.length)}
            >
              {selectedCount < selectable.length ? 'Select all' : 'Clear'}
            </Button>
          ) : null}
        </div>
        {isOpen ? (
          <div className="space-y-3 border-t border-white/5 px-3 py-2">
            {section.subCategories.map((sub) => {
              const items = sub.items.filter(passesVeg);
              if (!items.length) return null;
              return (
                <div key={sub.id}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{sub.label}</p>
                  <ul className="divide-y divide-white/5">{items.map((item) => renderItem(item))}</ul>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  const selectedCount = drafts.size;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add from catalog"
      description="Pick dishes and drinks, adjust names and prices, then add them to your menu. Placeholder photos are used until you upload your own."
      width="xl"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-sm text-text-muted">
            {selectedCount ? `${selectedCount} selected` : 'Nothing selected'}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              disabled={!selectedCount || Boolean(firstInvalid)}
              loading={importMutation.isPending}
              onClick={() => importMutation.mutate()}
              title={firstInvalid ? firstInvalid.error : undefined}
            >
              Add {selectedCount || ''} to menu
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {lastResult ? (
          <div className="space-y-1 rounded-lg border border-brand-primary/30 bg-brand-primary/5 p-3 text-sm">
            <p>
              Added {lastResult.created.length} item(s)
              {lastResult.skipped.length ? `, skipped ${lastResult.skipped.length} already on the menu` : ''}.
              {lastResult.recipesCreated
                ? ` Linked ${lastResult.recipesCreated} to stock (${lastResult.inventoryCreated} new inventory item(s) — set opening stock in Inventory).`
                : ''}
            </p>
            <p className="text-xs text-text-muted">
              Items use a category placeholder photo. Open an item and upload a real photo when you have one.
            </p>
            {lastResult.warnings.map((w) => (
              <p key={w} className="text-xs text-status-warning">{w}</p>
            ))}
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            label="Search catalog"
            placeholder="Paneer tikka, Old Monk, cappuccino…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex items-end gap-1">
            {(['all', 'veg', 'nonveg'] as const).map((v) => (
              <Button
                key={v}
                type="button"
                variant={vegFilter === v ? 'primary' : 'ghost'}
                onClick={() => setVegFilter(v)}
              >
                {v === 'all' ? 'All' : v === 'veg' ? 'Veg' : 'Non-veg'}
              </Button>
            ))}
          </div>
        </div>

        {catalogQuery.isLoading ? (
          <p className="text-sm text-text-muted">Loading catalog…</p>
        ) : catalogQuery.isError ? (
          <p className="text-sm text-status-error">{(catalogQuery.error as Error).message}</p>
        ) : searchResults ? (
          searchResults.length === 0 ? (
            <p className="text-sm text-text-muted">No catalog items match “{search}”.</p>
          ) : (
            <div>
              <p className="text-xs text-text-muted">
                {searchResults.length > SEARCH_LIMIT
                  ? `Showing ${SEARCH_LIMIT} of ${searchResults.length} matches`
                  : `${searchResults.length} match(es)`}
              </p>
              <ul className="divide-y divide-white/5">
                {searchResults
                  .slice(0, SEARCH_LIMIT)
                  .map(({ item, section, subLabel }) => renderItem(item, `${section.label} · ${subLabel}`))}
              </ul>
            </div>
          )
        ) : (
          <div className="space-y-2">
            {coreSections.map(renderSection)}
            {optionalSections.length ? (
              <>
                <Button type="button" variant="ghost" onClick={() => setShowOptional((v) => !v)}>
                  {showOptional ? 'Hide extra categories' : `More categories (${optionalSections.length})`}
                </Button>
                {showOptional ? optionalSections.map(renderSection) : null}
              </>
            ) : null}
          </div>
        )}

        {selectedCount > 0 && editingId === null ? (
          <p className="text-xs text-text-muted">
            Tip: tap Edit on a selected item to change its name, price or variants before adding.
          </p>
        ) : null}
        {sections.length === 0 && catalogQuery.isSuccess ? (
          <p className="text-sm text-text-muted">No catalog items are available for this business type.</p>
        ) : null}
      </div>
    </Drawer>
  );
}
