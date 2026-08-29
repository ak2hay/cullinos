'use client';

import Link from 'next/link';
import { useState } from 'react';
import { NAV_LINKS } from '@cullinos/shared';
import { getRegisterUrl } from '@/lib/urls';
import { Logo } from './Logo';

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-bg-primary/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo showTagline />

        <nav className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) =>
            'children' in link && link.children ? (
              <div
                key={link.label}
                className="relative"
                onMouseEnter={() => setSolutionsOpen(true)}
                onMouseLeave={() => setSolutionsOpen(false)}
              >
                <button
                  type="button"
                  className="text-sm text-text-secondary transition hover:text-text-primary"
                >
                  {link.label}
                </button>
                {solutionsOpen && (
                  <div className="absolute left-0 top-full pt-2">
                    <div className="min-w-48 rounded-lg border border-white/10 bg-bg-secondary p-2 shadow-xl">
                      {link.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="block rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-card hover:text-text-primary"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-text-secondary transition hover:text-text-primary"
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href={getRegisterUrl()}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-bg-primary transition hover:bg-brand-primary-dark"
          >
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/5 px-6 py-4 lg:hidden">
          <nav className="flex flex-col gap-3">
            {NAV_LINKS.flatMap((link) =>
              'children' in link && link.children
                ? link.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="text-sm text-text-secondary"
                      onClick={() => setMobileOpen(false)}
                    >
                      {child.label}
                    </Link>
                  ))
                : [
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-sm text-text-secondary"
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>,
                  ],
            )}
            <Link
              href={getRegisterUrl()}
              className="mt-2 rounded-lg bg-brand-primary px-4 py-2 text-center text-sm font-medium text-bg-primary"
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
