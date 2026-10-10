import { formatClock, type StorefrontBootstrap } from '@/lib/api';
import { SearchIcon, TableIcon } from './icons';

interface MenuHeroProps {
  data: StorefrontBootstrap;
  tableName?: string;
  onSearch: () => void;
}

export function MenuHero({ data, tableName, onSearch }: MenuHeroProps) {
  const cover = data.coverImageUrl || data.photoUrls?.[0] || null;
  const displayName = data.brandName || data.organizationName;
  const initial = displayName.trim().charAt(0).toUpperCase() || 'C';
  const hours = data.todayHours;

  return (
    <header className="relative overflow-hidden bg-qr-ink text-white">
      {cover ? (
        <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-qr-ink/85 via-qr-ink/70 to-qr-ink/95"
      />

      <div className="relative px-4 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-[1.75rem] font-extrabold leading-none tracking-tight">
              Cullinos<span className="text-qr-yellow">.</span>
            </p>
            <p className="mt-1.5 text-xs text-white/70">Good Food Brings People Together</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {tableName ? (
              <span className="flex h-10 items-center gap-2 rounded-full border border-white/25 bg-black/30 px-3.5 text-sm font-semibold backdrop-blur">
                <TableIcon size={16} className="text-qr-yellow" />
                Table {tableName}
              </span>
            ) : null}
            <button
              type="button"
              onClick={onSearch}
              aria-label="Search the menu"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/30 backdrop-blur"
            >
              <SearchIcon size={18} />
            </button>
          </div>
        </div>

        <div className="mt-7 flex items-center gap-3.5">
          {data.logoUrl ? (
            <img
              src={data.logoUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-2xl bg-white object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-qr-yellow font-display text-2xl font-extrabold text-qr-ink">
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-bold uppercase tracking-[0.18em] text-qr-yellow">
              {displayName}
            </p>
            <h1 className="truncate font-display text-2xl font-extrabold leading-tight">
              {data.outletName}
            </h1>
            {data.openNow != null || hours ? (
              <div className="mt-1 flex items-center gap-2 text-xs text-white/80">
                {data.openNow != null ? (
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      data.openNow ? 'bg-qr-veg/20 text-green-300' : 'bg-qr-nonveg/25 text-red-200'
                    }`}
                  >
                    {data.openNow ? 'Open' : 'Closed'}
                  </span>
                ) : null}
                {hours ? (
                  <span>
                    {hours.closed
                      ? 'Closed today'
                      : `${formatClock(hours.open)} - ${formatClock(hours.close)}`}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
