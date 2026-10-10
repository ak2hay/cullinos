import { forwardRef } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter in the search box (e.g. add the item whose short code was typed). */
  onSubmit?: (value: string) => void;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  function SearchBar({ value, onChange, onSubmit }, ref) {
    return (
      <div className="relative">
        <input
          ref={ref}
          type="search"
          placeholder="Search items or short code… ( / )"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSubmit) {
              e.preventDefault();
              onSubmit(value);
            }
          }}
          className="h-9 w-full rounded-lg border border-line bg-bg-elevated pl-3 pr-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
      </div>
    );
  },
);
