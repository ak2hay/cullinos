import Image from 'next/image';
import Link from 'next/link';
import { TRIAL_CTA_LABEL } from '@cullinos/shared';
import { TrialTerms } from '@/components/marketing/TrialTerms';
import { WhatsAppLink } from '@/components/marketing/WhatsAppLink';
import { getRegisterUrl } from '@/lib/urls';

export function HomeHero() {
  const registerUrl = getRegisterUrl();

  return (
    <section className="mx-auto grid max-w-7xl items-center gap-8 px-6 py-8 lg:grid-cols-2 lg:gap-12 lg:px-10 lg:py-12">
      <div>
        <p className="text-xs font-medium tracking-wide text-brand-gold uppercase">
          Restaurant POS &amp; GST Billing Software
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-text-primary md:text-5xl">
          Billing, KOT and online orders in one app.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-text-secondary md:text-lg">
          GST-ready billing for restaurants in India. One menu for the cashier, the kitchen ticket, and online
          orders.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href={registerUrl} className="btn-pill-filled btn-pill">
            {TRIAL_CTA_LABEL}
          </Link>
          <WhatsAppLink />
        </div>
        <TrialTerms className="mt-3" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border-light bg-bg-card shadow-card">
        <Image
          src="/images/product-pos.jpg"
          alt="Cullinos POS billing screen with a demo order and GST tax lines"
          width={1280}
          height={800}
          priority
          fetchPriority="high"
          sizes="(max-width: 1024px) 100vw, 640px"
          className="h-auto w-full"
        />
      </div>
    </section>
  );
}
