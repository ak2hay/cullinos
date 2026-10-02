import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, Store } from 'lucide-react';
import { outletsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const SEARCH_THRESHOLD = 6;

export function OutletSelector() {
  const selectedOutletId = useAuthStore((s) => s.selectedOutletId);
  const setSelectedOutlet = useAuthStore((s) => s.setSelectedOutlet);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const { data: outlets = [], isLoading } = useQuery({
    queryKey: ['outlets'],
    queryFn: outletsApi.list,
  });

  useEffect(() => {
    if (outlets.length === 0) return;
    const stillValid =
      selectedOutletId != null && outlets.some((o) => o.id === selectedOutletId);
    // Stale IDs (e.g. after re-seed) still render a label in some browsers but fail API calls.
    if (!stillValid) {
      setSelectedOutlet(outlets[0].id);
    }
  }, [outlets, selectedOutletId, setSelectedOutlet]);

  const showSearch = outlets.length >= SEARCH_THRESHOLD;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return outlets;
    return outlets.filter(
      (o) => o.name.toLowerCase().includes(q) || (o.city ?? '').toLowerCase().includes(q),
    );
  }, [outlets, query]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const selectedIndex = outlets.findIndex((o) => o.id === selectedOutletId);
    setActive(Math.max(selectedIndex, 0));
    if (showSearch) searchRef.current?.focus();
    else listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (isLoading) {
    return <div className="ui-skeleton h-10 w-36 rounded-xl sm:w-44" />;
  }

  if (outlets.length === 0) {
    return <span className="text-sm text-text-muted">No outlets</span>;
  }

  const selected = outlets.find((o) => o.id === selectedOutletId) ?? outlets[0];

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(id: string) {
    setSelectedOutlet(id);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const outlet = filtered[active];
      if (outlet) choose(outlet.id);
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Outlet: ${selected.name}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 min-w-0 items-center gap-2 rounded-xl border border-line bg-bg-card px-3 text-sm font-medium text-text-primary shadow-sm transition-colors hover:border-line-strong focus:border-brand-primary focus:outline-none"
      >
        <Store size={16} className="shrink-0 text-brand-primary" aria-hidden="true" />
        <span className="max-w-[8.5rem] truncate sm:max-w-[16rem]">{selected.name}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 z-50 mt-2 w-72 max-w-[calc(100vw-1.5rem)] origin-top-left animate-scale-in rounded-xl border border-line bg-bg-card p-2 shadow-lg"
          onKeyDown={onKeyDown}
        >
          <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Outlets
          </p>
          {showSearch ? (
            <div className="relative mb-2">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder="Search outlets"
                aria-label="Search outlets"
                className="h-9 w-full rounded-lg border border-line bg-bg-elevated pl-8 pr-2 text-sm text-text-primary outline-none focus:border-brand-primary"
              />
            </div>
          ) : null}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label="Outlets"
            aria-activedescendant={filtered[active] ? `${listId}-${filtered[active].id}` : undefined}
            className="max-h-72 overflow-y-auto outline-none"
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-4 text-center text-sm text-text-muted">No matching outlets</li>
            ) : (
              filtered.map((outlet, index) => {
                const isSelected = outlet.id === selected.id;
                return (
                  <li
                    key={outlet.id}
                    id={`${listId}-${outlet.id}`}
                    role="option"
                    aria-selected={isSelected}
                    data-index={index}
                    onPointerEnter={() => setActive(index)}
                    onClick={() => choose(outlet.id)}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 ${
                      isSelected ? 'bg-brand-primary/10' : index === active ? 'bg-hover' : ''
                    } ${index === active && isSelected ? 'ring-1 ring-brand-primary/40' : ''}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm ${
                          isSelected ? 'font-semibold text-brand-primary' : 'font-medium text-text-primary'
                        }`}
                      >
                        {outlet.name}
                      </span>
                      {outlet.city ? (
                        <span className="block truncate text-xs text-text-muted">{outlet.city}</span>
                      ) : null}
                    </span>
                    {isSelected ? (
                      <Check size={16} className="shrink-0 text-brand-primary" aria-hidden="true" />
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
