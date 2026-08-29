'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { APP_SHOWCASE_ITEMS } from '@cullinos/shared';
import { MarketingImage } from '@/components/marketing/MarketingImage';
import { Reveal } from '@/components/marketing/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/marketing/motion/Stagger';

export function AllAppsShowcase() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
      <Reveal className="mb-12 max-w-2xl">
        <h2 className="font-serif text-3xl font-medium md:text-4xl">Every app your team needs</h2>
        <p className="mt-3 text-text-secondary">
          Six purpose-built apps — one login, one menu, one order system. No more juggling separate tools.
        </p>
      </Reveal>

      <Stagger className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {APP_SHOWCASE_ITEMS.map((app) => {
          const isFeatured = app.title === 'Kitchen Display';
          return (
            <StaggerItem key={app.title}>
              <motion.div
                whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  href={app.href}
                  className={`group block overflow-hidden rounded-2xl border bg-bg-card shadow-card transition-shadow duration-300 hover:shadow-soft ${
                    isFeatured ? 'border-brand-gold/50 ring-1 ring-brand-gold/20' : 'border-border-light'
                  }`}
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-bg-elevated">
                    <MarketingImage
                      imageKey={app.imageKey}
                      alt={app.title}
                      fill
                      className="object-cover object-top transition duration-500 group-hover:scale-[1.03]"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="font-serif text-lg font-medium transition group-hover:text-brand-gold">
                      {app.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">{app.benefit}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium tracking-wide text-brand-gold uppercase">
                      Learn more
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
