import type { ComponentType } from 'react';
import type { MenuCategory } from '@/lib/api';
import {
  BowlIcon,
  CakeIcon,
  ClocheIcon,
  CupIcon,
  GridIcon,
  LeafIcon,
  PizzaIcon,
  SparkIcon,
  UtensilsIcon,
} from './icons';

type IconComponent = ComponentType<{ size?: number; className?: string }>;

const ICON_RULES: Array<[RegExp, IconComponent]> = [
  [/starter|appeti|snack|small plate|chaat|tikka|kebab/i, LeafIcon],
  [/main|curry|entr|thali|biryani|rice/i, ClocheIcon],
  [/drink|beverage|juice|shake|tea|coffee|chai|cocktail|mocktail|bar|beer|wine|soda/i, CupIcon],
  [/dessert|sweet|cake|ice ?cream|bake/i, CakeIcon],
  [/pizza|burger|sandwich|wrap|roll/i, PizzaIcon],
  [/soup|salad|bowl|noodle/i, BowlIcon],
  [/special|chef|signature|combo/i, SparkIcon],
];

export function categoryIcon(name: string): IconComponent {
  return ICON_RULES.find(([re]) => re.test(name))?.[1] ?? UtensilsIcon;
}

interface CategoryRailProps {
  categories: MenuCategory[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryRail({ categories, activeId, onSelect }: CategoryRailProps) {
  return (
    <nav aria-label="Menu categories" className="no-scrollbar flex gap-2.5 overflow-x-auto px-4 py-3">
      <Chip label="All" active={activeId == null} onClick={() => onSelect(null)} Icon={GridIcon} />
      {categories.map((cat) => (
        <Chip
          key={cat.id}
          label={cat.name}
          active={activeId === cat.id}
          onClick={() => onSelect(cat.id)}
          imageUrl={cat.imageUrl}
          Icon={categoryIcon(cat.name)}
        />
      ))}
    </nav>
  );
}

function Chip({
  label,
  active,
  onClick,
  imageUrl,
  Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  imageUrl?: string | null;
  Icon: IconComponent;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-12 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-semibold shadow-sm transition-colors ${
        active ? 'bg-qr-yellow text-qr-ink' : 'bg-bg-card text-text-primary'
      }`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-6 w-6 rounded-md object-cover" />
      ) : (
        <Icon size={20} />
      )}
      {label}
    </button>
  );
}
