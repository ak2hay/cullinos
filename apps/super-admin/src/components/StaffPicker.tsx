import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { inputClass } from '@/components/common';
import { peopleApi } from '@/lib/platform-api';

/** Search-as-you-type picker over the employee directory. */
export function StaffPicker({
  value,
  onChange,
  placeholder = 'Search name, email or employee ID…',
  allowClear = true,
}: {
  value: { userId: string; label: string } | null;
  onChange: (v: { userId: string; label: string } | null) => void;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const results = useQuery({
    queryKey: ['super-admin', 'staff-picker', q],
    queryFn: () => peopleApi.directory({ q, limit: 10, status: 'active' }),
    enabled: open,
  });

  if (value) {
    return (
      <div className={`${inputClass} flex items-center justify-between`}>
        <span className="truncate">{value.label}</span>
        {allowClear ? (
          <button type="button" className="text-xs text-text-muted hover:text-text-primary" onClick={() => onChange(null)}>
            Change
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        className={inputClass}
        placeholder={placeholder}
        value={q}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQ(e.target.value)}
      />
      {open ? (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-bg-secondary shadow-lg">
          {(results.data?.data ?? []).map((e) => (
            <li key={e.userId}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-hover"
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => {
                  onChange({ userId: e.userId, label: `${e.name} (${e.employeeCode})` });
                  setQ('');
                  setOpen(false);
                }}
              >
                <span className="font-medium">{e.name}</span>{' '}
                <span className="text-text-muted">
                  {e.employeeCode} · {e.title ?? e.primaryRole}
                </span>
              </button>
            </li>
          ))}
          {results.data && results.data.data.length === 0 ? (
            <li className="px-3 py-2 text-sm text-text-muted">No matches</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
