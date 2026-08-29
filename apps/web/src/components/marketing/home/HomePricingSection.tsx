'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { formatInr, MARKETING_PLANS } from '@cullinos/shared';
import { getRegisterUrl } from '@/lib/urls';
import { MarketingImage } from '@/components/marketing/MarketingImage';
import { PricingTeaser } from '@/components/marketing/PricingTable';
import { Reveal } from '@/components/marketing/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/marketing/motion/Stagger';

export function HomePricingSection() {
  const starterPlan = MARKETING_PLANS[0];
  const prefersReducedMotion = useReducedMotion();

  return (
    <>
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <Reveal className="mb-10 text-center">
          <h2 className="font-serif text-3xl font-medium md:text-4xl">Plans that grow with you</h2>
          <p className="mt-3 text-text-secondary">
            From ₹{formatInr(starterPlan.priceMonthly).replace('₹', '')}/month. Every plan includes cloud hosting, updates, and support.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <PricingTeaser />
        </Reveal>
        <div className="mt-8 text-center">
          <Link href="/pricing" className="text-sm font-medium text-brand-gold hover:underline">
            Compare all plans and features →
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-10">
        <Stagger className="grid gap-8 md:grid-cols-3">
          <StaggerItem>
            <motion.article
              className="flex flex-col rounded-3xl bg-bg-card p-8 shadow-card"
              whileHover={prefersReducedMotion ? undefined : { y: -4 }}
            >
              <h3 className="font-serif text-2xl font-medium">Solutions</h3>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-text-secondary">
                Single outlet, growing chain, or hotel F&B — pick the workflow that fits your business.
              </p>
              <Link href="/solutions/restaurants" className="btn-pill-filled btn-pill mt-8 w-fit">
                View solutions
              </Link>
            </motion.article>
          </StaggerItem>

          <StaggerItem>
            <motion.article
              className="flex flex-col overflow-hidden rounded-3xl bg-bg-dark p-8 text-text-inverse shadow-soft"
              whileHover={prefersReducedMotion ? undefined : { y: -4 }}
            >
              <h3 className="font-serif text-2xl font-medium">See it in action</h3>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-white/75">
                Explore every module — POS, kitchen, ordering, admin, and enterprise — on the features page.
              </p>
              <motion.div
                className="relative mt-6 aspect-video overflow-hidden rounded-2xl border border-white/10"
                whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                transition={{ duration: 0.3 }}
              >
                <MarketingImage
                  imageKey="mockupAdmin"
                  alt="Cullinos admin dashboard"
                  fill
                  className="object-contain p-2"
                  sizes="300px"
                />
              </motion.div>
              <Link href="/features" className="btn-pill mt-6 w-fit border-white text-white hover:bg-white hover:text-bg-dark">
                Explore features
              </Link>
            </motion.article>
          </StaggerItem>

          <StaggerItem>
            <motion.article
              className="overflow-hidden rounded-3xl bg-bg-card shadow-card"
              whileHover={prefersReducedMotion ? undefined : { y: -4 }}
            >
              <div className="p-8 pb-4">
                <h3 className="font-serif text-2xl font-medium">Get started free</h3>
                <p className="mt-3 text-sm text-text-secondary">
                  Create your organization in minutes. No credit card required to start.
                </p>
              </div>
              <div className="relative mx-4 aspect-video overflow-hidden rounded-2xl bg-bg-elevated">
                <MarketingImage
                  imageKey="mockupPos"
                  alt="Cullinos POS screen"
                  fill
                  className="object-contain p-2"
                  sizes="300px"
                />
              </div>
              <div className="p-6 pt-4">
                <Link href={getRegisterUrl()} className="btn-pill-filled btn-pill w-full text-center">
                  Start free trial
                </Link>
              </div>
            </motion.article>
          </StaggerItem>
        </Stagger>
      </section>
    </>
  );
}
