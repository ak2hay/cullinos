import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-24 text-center lg:px-10">
      <p className="text-xs font-medium tracking-[0.2em] text-brand-gold uppercase">404</p>
      <h1 className="mt-4 font-serif text-4xl font-medium text-text-primary md:text-5xl">
        Page not found
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-text-secondary md:text-base">
        That link may be outdated or the page moved. Try one of these instead.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link href="/" className="btn-pill-filled btn-pill">
          Go home
        </Link>
        <Link href="/pricing" className="btn-pill">
          Pricing
        </Link>
        <Link href="/contact" className="btn-pill">
          Contact
        </Link>
      </div>
    </section>
  );
}
