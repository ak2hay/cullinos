import Link from 'next/link';
import { getRegisterUrl } from '@/lib/urls';

interface HeroProps {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string } | null;
}

export function Hero({
  eyebrow,
  title,
  subtitle,
  primaryCta = { label: 'Start free trial', href: getRegisterUrl() },
  secondaryCta = { label: 'Book a demo', href: '/contact' },
}: HeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(212,160,23,0.12),_transparent_55%)]" />
      <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
        {eyebrow && (
          <p className="mb-4 text-sm font-medium uppercase tracking-wider text-brand-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">{title}</h1>
        <p className="mt-6 max-w-2xl text-lg text-text-secondary">{subtitle}</p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href={primaryCta.href}
            className="rounded-lg bg-brand-primary px-6 py-3 text-sm font-medium text-bg-primary transition hover:bg-brand-primary-dark"
          >
            {primaryCta.label}
          </Link>
          {secondaryCta && (
            <Link
              href={secondaryCta.href}
              className="rounded-lg border border-white/10 px-6 py-3 text-sm font-medium text-text-primary transition hover:border-brand-primary/50 hover:text-brand-primary"
            >
              {secondaryCta.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
