'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useMarketingCms } from '@/components/marketing/MarketingCmsProvider';
import { getRegisterUrl } from '@/lib/urls';
import { Logo } from './Logo';

const fallbackNav = [
  { href: '/', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/about', label: 'About' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
];

export function MarketingNav() {
  const cms = useMarketingCms();
  const navItems = useMemo(() => {
    const items = [...cms.navItems]
      .filter((n) => (n.groupKey ?? 'main') === 'main')
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((n) => ({ href: n.href, label: n.label }));
    return items.length ? items : fallbackNav;
  }, [cms.navItems]);
  const registerUrl = cms.site?.registerUrl || getRegisterUrl();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-border-light/60 bg-bg-primary/80 shadow-soft backdrop-blur-md' : 'bg-bg-primary/95 backdrop-blur-sm'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Logo variant="icon" />

        <nav className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative text-xs font-medium tracking-[0.15em] uppercase transition ${
                  active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {item.label}
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute -bottom-1 left-0 h-px w-full bg-brand-gold"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:block">
          <Link href={registerUrl} className="btn-pill">
            Start free trial
          </Link>
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-text-secondary lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
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

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 top-[72px] z-40 bg-bg-dark/20 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="relative z-50 border-t border-border-light bg-bg-primary px-6 py-4 lg:hidden"
            >
              <nav className="flex flex-col gap-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-xs font-medium tracking-[0.15em] uppercase ${
                      pathname === item.href ? 'text-brand-gold' : 'text-text-secondary'
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href={registerUrl}
                  className="btn-pill mt-2 text-center"
                  onClick={() => setMobileOpen(false)}
                >
                  Start free trial
                </Link>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
