'use client';

import Link from 'next/link';
import { Reveal } from '@/components/marketing/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/marketing/motion/Stagger';
import { MarketingCard } from '@/components/marketing/MarketingCard';

const reviews = [
  {
    quote:
      'Cullinos replaced three separate systems for our restaurant. POS, kitchen, and online ordering finally talk to each other.',
    author: 'Restaurant operator',
    role: 'Multi-outlet chain, Mumbai',
  },
  {
    quote:
      'GST billing works out of the box. Our accountants love the clean reports and we love not juggling spreadsheets.',
    author: 'F&B manager',
    role: 'Full-service restaurant, Bangalore',
  },
];

export function ReviewsSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
      <div className="grid gap-12 lg:grid-cols-2">
        <Reveal>
          <span className="font-serif text-6xl leading-none text-brand-gold/30">&ldquo;</span>
          <h2 className="-mt-4 font-serif text-3xl font-medium">Trusted by restaurant teams</h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-text-secondary">
            Early partners run their daily operations on Cullinos. Join them and simplify how your restaurant works.
          </p>
          <Link href="/contact" className="btn-pill-gold btn-pill mt-8 inline-flex">
            Talk to our team
          </Link>
        </Reveal>

        <Stagger className="space-y-6">
          {reviews.map((review) => (
            <StaggerItem key={review.author}>
              <MarketingCard className="relative p-6">
                <span className="absolute top-4 right-6 font-serif text-4xl text-brand-gold/20">&rdquo;</span>
                <p className="font-serif text-lg leading-relaxed text-text-primary">
                  &ldquo;{review.quote}&rdquo;
                </p>
                <footer className="mt-4 text-sm text-text-muted">
                  <cite className="not-italic font-medium text-text-secondary">
                    {review.author}
                  </cite>
                  <span className="block text-xs">{review.role}</span>
                </footer>
              </MarketingCard>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
