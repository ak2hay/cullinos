interface CategoryTabsProps {
  categories: Array<{ id: string; name: string }>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryTabs({ categories, selectedId, onSelect }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-xl px-5 py-3 text-base font-medium transition active:scale-95 ${
          selectedId === null
            ? 'bg-brand-primary text-bg-primary'
            : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
        }`}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          className={`shrink-0 rounded-xl px-5 py-3 text-base font-medium transition active:scale-95 ${
            selectedId === category.id
              ? 'bg-brand-primary text-bg-primary'
              : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
          }`}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
