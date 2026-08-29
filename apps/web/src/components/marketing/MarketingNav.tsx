'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { getRegisterUrl } from '@/lib/urls';
import { Logo } from './Logo';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/about', label: 'About' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
];

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-bg-primary/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Logo variant="icon" />

        <nav className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-xs font-medium tracking-[0.15em] uppercase transition ${
                pathname === item.href
                  ? 'text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:block">
          <Link href={getRegisterUrl()} className="btn-pill">
            Start free trial
          </Link>
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-text-secondary lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border-light px-6 py-4 lg:hidden">
          <nav className="flex flex-col gap-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-xs font-medium tracking-[0.15em] uppercase text-text-secondary"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={getRegisterUrl()}
              className="btn-pill mt-2 text-center"
              onClick={() => setMobileOpen(false)}
            >
              Start free trial
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
