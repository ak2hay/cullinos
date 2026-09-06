interface CategoryTabsProps {
  categories: Array<{ id: string; name: string }>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryTabs({ categories, selectedId, onSelect }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold tracking-wide transition active:scale-95 ${
          selectedId === null
            ? 'bg-brand-primary text-bg-primary shadow-md shadow-brand-primary/25'
            : 'border border-white/10 bg-bg-elevated/80 text-text-secondary hover:border-white/20 hover:text-text-primary'
        }`}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold tracking-wide transition active:scale-95 ${
            selectedId === category.id
              ? 'bg-brand-primary text-bg-primary shadow-md shadow-brand-primary/25'
              : 'border border-white/10 bg-bg-elevated/80 text-text-secondary hover:border-white/20 hover:text-text-primary'
          }`}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
