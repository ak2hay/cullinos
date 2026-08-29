import Link from 'next/link';

export function ComingSoonCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-border-light bg-bg-card p-8 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary">
        <span className="font-serif text-lg text-brand-gold">✦</span>
      </div>
      <p className="text-sm leading-relaxed text-text-secondary">{message}</p>
      <Link href="/contact" className="btn-pill-gold btn-pill mt-6 inline-flex">
        Get in touch
      </Link>
    </div>
  );
}
