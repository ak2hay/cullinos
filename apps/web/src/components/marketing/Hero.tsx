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
    <section className="border-b border-border-light bg-bg-elevated">
      <div className="mx-auto max-w-7xl px-6 py-16 md:py-24 lg:px-10">
        {eyebrow && (
          <p className="mb-4 text-xs font-medium tracking-[0.2em] uppercase text-brand-gold">
            {eyebrow}
          </p>
        )}
        <h1 className="max-w-3xl font-serif text-4xl font-medium leading-tight md:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-text-secondary">{subtitle}</p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href={primaryCta.href} className="btn-pill-filled btn-pill">
            {primaryCta.label}
          </Link>
          {secondaryCta && (
            <Link href={secondaryCta.href} className="btn-pill">
              {secondaryCta.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
