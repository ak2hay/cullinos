'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MARKETING_IMAGES } from '@cullinos/shared';
import { useMarketingCms } from '@/components/marketing/MarketingCmsProvider';
import { resolveMarketingImage } from '@/lib/marketing-content';
import { getRegisterUrl } from '@/lib/urls';
import Image from 'next/image';
import { easeOut } from '@/components/marketing/motion/motionVariants';

const AUTOPLAY_MS = 6000;

export function HomeHeroCarousel() {
  const cms = useMarketingCms();
  const slides = useMemo(
    () =>
      [...cms.heroSlides]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({
          id: s.id,
          imageKey: s.imageKey ?? 'heroRestaurant',
          alt: s.imageAsset?.alt ?? s.headline,
          headline: s.headline,
          headlineAccent: s.headlineAccent,
          subline: s.subline,
          imageSrc:
            s.imageAsset?.url ??
            resolveMarketingImage(
              cms,
              s.imageKey ?? 'heroRestaurant',
              MARKETING_IMAGES.heroRestaurant,
            ),
        })),
    [cms],
  );

  const registerUrl = cms.site?.registerUrl || getRegisterUrl();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const slide = slides[current] ?? slides[0];

  const prev = useCallback(() => {
    setCurrent((i) => (i === 0 ? slides.length - 1 : i - 1));
  }, [slides.length]);

  const next = useCallback(() => {
    setCurrent((i) => (i === slides.length - 1 ? 0 : i + 1));
  }, [slides.length]);

  useEffect(() => {
    if (paused || prefersReducedMotion || slides.length <= 1) return;
    const timer = setInterval(next, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, prefersReducedMotion, next, current, slides.length]);

  if (!slide) return null;

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
                  key={s.id}
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
                      src={s.imageSrc}
                      alt={s.alt}
                      fill
                      priority={i === 0}
                      className="object-cover"
                      sizes="(max-width: 1280px) 100vw, 1280px"
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
                    href={registerUrl}
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
                key={s.id}
                type="button"
                onClick={() => setCurrent(i)}
                aria-label={`Go to slide ${i + 1}`}
                className="relative h-2.5 w-2.5 rounded-full transition"
              >
                <span
                  className={`absolute inset-0 rounded-full ${i === current ? 'bg-white' : 'bg-white/40'}`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
