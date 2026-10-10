import { forwardRef } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  function SearchBar({ value, onChange }, ref) {
    return (
      <div className="relative">
        <input
          ref={ref}
          type="search"
          placeholder="Search items… ( / )"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-lg border border-line bg-bg-elevated pl-3 pr-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
      </div>
    );
  },
);
