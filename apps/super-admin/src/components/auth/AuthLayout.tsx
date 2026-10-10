import type { ReactNode } from 'react';
import { BadgeCheck, Building2, ChefHat, ShieldCheck } from 'lucide-react';
import { RKYVES_BRAND } from '@/lib/api';

const HIGHLIGHTS = [
  { icon: Building2, title: 'Every tenant in one place', body: 'Onboard restaurants, manage plans and subscriptions.' },
  { icon: BadgeCheck, title: 'Maker-checker by default', body: 'Sensitive actions route through approvals.' },
  { icon: ShieldCheck, title: 'Audited access', body: 'Every staff action is tied to an employee ID.' },
];

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-bg-primary lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-sidebar-bg p-10 text-sidebar-fg lg:flex lg:flex-col">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(700px 400px at 0% 0%, rgba(99,102,241,0.35), transparent 60%), radial-gradient(600px 400px at 100% 100%, rgba(129,140,248,0.18), transparent 60%)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-200">
            <ChefHat size={22} aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-lg font-bold leading-tight text-white">{RKYVES_BRAND.product}</p>
            <p className="text-xs text-sidebar-muted">Super Admin</p>
          </div>
        </div>
        <div className="relative mt-auto max-w-md">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-white">
            Run the {RKYVES_BRAND.product} platform with confidence.
          </h2>
          <ul className="mt-8 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title: t, body }) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-indigo-300">
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{t}</span>
                  <span className="block text-sm text-sidebar-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-xs text-sidebar-muted">
            {RKYVES_BRAND.name} · {RKYVES_BRAND.tagline}
          </p>
        </div>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white">
              <ChefHat size={22} aria-hidden="true" />
            </span>
            <p className="font-display text-lg font-bold">{RKYVES_BRAND.product} Super Admin</p>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-sm text-text-secondary">{subtitle}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
      {children}
    </p>
  );
}

export function AuthNote({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm text-text-secondary">{children}</p>;
}
