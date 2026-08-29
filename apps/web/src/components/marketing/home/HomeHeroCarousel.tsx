'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { MARKETING_IMAGES } from '@cullinos/shared';
import { getRegisterUrl } from '@/lib/urls';
import { isRemoteImage } from '@/lib/images';
import Image from 'next/image';
import { easeOut } from '@/components/marketing/motion/motionVariants';

const slides = [
  {
    imageKey: 'heroRestaurant' as const,
    alt: 'Fine dining restaurant',
    headline: 'Run your restaurant',
    headlineAccent: 'from one place.',
    subline:
      'Cullinos is cloud software that runs your POS, kitchen, waiter app, online orders, and back office — together.',
  },
  {
    imageKey: 'heroKitchen' as const,
    alt: 'Restaurant kitchen',
    headline: 'Your kitchen,',
    headlineAccent: 'always in sync.',
    subline: 'Every order from cashier, waiter, or QR menu appears on the kitchen display instantly.',
  },
  {
    imageKey: 'heroTeam' as const,
    alt: 'Restaurant team',
    headline: 'One platform,',
    headlineAccent: 'every team member.',
    subline: 'Cashiers, waiters, managers, and owners — each with the right tools and permissions.',
  },
];

const AUTOPLAY_MS = 6000;

export function HomeHeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const slide = slides[current];

  const prev = useCallback(() => {
    setCurrent((i) => (i === 0 ? slides.length - 1 : i - 1));
  }, []);

  const next = useCallback(() => {
    setCurrent((i) => (i === slides.length - 1 ? 0 : i + 1));
  }, []);

  useEffect(() => {
    if (paused || prefersReducedMotion) return;
    const timer = setInterval(next, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, prefersReducedMotion, next, current]);

  return (
    <section
      className="mx-auto max-w-7xl px-6 pt-4 pb-8 lg:px-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-[2rem] shadow-soft">
        <div className="relative aspect-[16/7] min-h-[360px] w-full md:aspect-[16/6]">
          <AnimatePresence mode="sync">
            {slides.map((s, i) =>
              i === current ? (
                <motion.div
                  key={s.imageKey}
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0.01 : 0.8, ease: easeOut }}
                >
                  <motion.div
                    className="absolute inset-0"
                    initial={{ scale: 1 }}
                    animate={{ scale: prefersReducedMotion ? 1 : 1.05 }}
                    transition={{ duration: AUTOPLAY_MS / 1000, ease: 'linear' }}
                  >
                    <Image
                      src={MARKETING_IMAGES[s.imageKey]}
                      alt={s.alt}
                      fill
                      priority={i === 0}
                      className="object-cover"
                      sizes="(max-width: 1280px) 100vw, 1280px"
                      unoptimized={!isRemoteImage(MARKETING_IMAGES[s.imageKey])}
                    />
                  </motion.div>
                </motion.div>
              ) : null,
            )}
          </AnimatePresence>

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />

          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -10 }}
                transition={{ duration: prefersReducedMotion ? 0.01 : 0.5, ease: easeOut }}
              >
                <p className="mb-3 text-xs font-medium tracking-[0.2em] text-brand-gold uppercase">
                  Restaurant Operating System
                </p>
                <h1 className="max-w-3xl font-serif text-4xl leading-tight text-white md:text-5xl lg:text-6xl">
                  {slide.headline}
                  <br />
                  <span className="text-brand-gold">{slide.headlineAccent}</span>
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/85 md:text-base">
                  {slide.subline}
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-4">
                  <Link
                    href={getRegisterUrl()}
                    className="btn-pill-filled btn-pill border-white bg-white text-bg-dark hover:bg-brand-gold hover:border-brand-gold"
                  >
                    Start free trial
                  </Link>
                  <Link href="/features" className="btn-pill border-white text-white hover:bg-white hover:text-bg-dark">
                    See all features
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={prev}
            className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/40 md:left-6"
            aria-label="Previous slide"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/40 md:right-6"
            aria-label="Next slide"
          >
            ›
          </button>

          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((s, i) => (
              <button
                key={s.imageKey}
                type="button"
                onClick={() => setCurrent(i)}
                aria-label={`Go to slide ${i + 1}`}
                className="relative h-2.5 w-2.5 rounded-full transition"
              >
                <span
                  className={`absolute inset-0 rounded-full ${i === current ? 'bg-white' : 'bg-white/40'}`}
                />
                {i === current && !prefersReducedMotion && !paused && (
                  <motion.span
                    className="absolute inset-0 rounded-full border-2 border-white"
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: AUTOPLAY_MS / 1000, ease: 'linear', repeat: Infinity }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
