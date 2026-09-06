import Link from 'next/link';
import { createMetadata } from '@/lib/metadata';
import { BUSINESS_NAP } from '@/lib/business';

export const metadata = {
  ...createMetadata({
    title: 'Thank you',
    description: 'Thanks for contacting Cullinos. We will get back to you shortly.',
    path: '/thank-you',
  }),
  robots: { index: false, follow: false },
};

export default function ThankYouPage() {
  return (
    <section className="mx-auto flex min-h-[55vh] max-w-2xl flex-col items-center justify-center px-6 py-24 text-center lg:px-10">
      <p className="text-xs font-medium tracking-[0.2em] text-brand-gold uppercase">Message received</p>
      <h1 className="mt-4 font-serif text-4xl font-medium text-text-primary md:text-5xl">
        Thank you
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-text-secondary md:text-base">
        Thanks for reaching out. Our team will get back to you within one business day. You can also email{' '}
        <a href={`mailto:${BUSINESS_NAP.email}`} className="text-brand-gold hover:underline">
          {BUSINESS_NAP.email}
        </a>
        .
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link href="/" className="btn-pill-filled btn-pill">
          Back to home
        </Link>
        <Link href="/features" className="btn-pill">
          Explore features
        </Link>
      </div>
    </section>
  );
}
