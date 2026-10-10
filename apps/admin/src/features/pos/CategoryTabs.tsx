interface CategoryTabsProps {
  categories: Array<{ id: string; name: string }>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryTabs({ categories, selectedId, onSelect }: CategoryTabsProps) {
  return (
    <div className="flex shrink-0 gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition active:scale-95 ${
          selectedId === null
            ? 'bg-brand-primary text-on-brand shadow-md shadow-brand-primary/25'
            : 'border border-line bg-bg-elevated/80 text-text-secondary hover:border-line-strong hover:text-text-primary'
        }`}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition active:scale-95 ${
            selectedId === category.id
              ? 'bg-brand-primary text-on-brand shadow-md shadow-brand-primary/25'
              : 'border border-line bg-bg-elevated/80 text-text-secondary hover:border-line-strong hover:text-text-primary'
          }`}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
