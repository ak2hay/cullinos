'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { MARKETING_IMAGES } from '@cullinos/shared';
import { getRegisterUrl } from '@/lib/urls';
import { isRemoteImage } from '@/lib/images';

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

export function HomeHeroCarousel() {
  const [current, setCurrent] = useState(0);
  const slide = slides[current];
  const imageSrc = MARKETING_IMAGES[slide.imageKey];

  function prev() {
    setCurrent((i) => (i === 0 ? slides.length - 1 : i - 1));
  }

  function next() {
    setCurrent((i) => (i === slides.length - 1 ? 0 : i + 1));
  }

  return (
    <section className="mx-auto max-w-7xl px-6 pt-4 pb-8 lg:px-10">
      <div className="relative overflow-hidden rounded-[2rem] shadow-soft">
        <div className="relative aspect-[16/7] min-h-[360px] w-full md:aspect-[16/6]">
          <Image
            src={imageSrc}
            alt={slide.alt}
            fill
            priority
            className="object-cover transition-opacity duration-500"
            sizes="(max-width: 1280px) 100vw, 1280px"
            unoptimized={!isRemoteImage(imageSrc)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />

          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
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
              <Link href={getRegisterUrl()} className="btn-pill-filled btn-pill border-white bg-white text-bg-dark hover:bg-brand-gold hover:border-brand-gold">
                Start free trial
              </Link>
              <Link href="/features" className="btn-pill border-white text-white hover:bg-white hover:text-bg-dark">
                See all features
              </Link>
            </div>
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
        </div>
      </div>
    </section>
  );
}
