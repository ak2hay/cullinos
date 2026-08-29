import Link from 'next/link';

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
        <div>
          <h2 className="font-serif text-3xl font-medium">Trusted by restaurant teams</h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-text-secondary">
            Early partners run their daily operations on Cullinos. Join them and simplify how your restaurant works.
          </p>
          <Link href="/contact" className="btn-pill-gold btn-pill mt-8 inline-flex">
            Talk to our team
          </Link>
        </div>

        <div className="space-y-6">
          {reviews.map((review) => (
            <blockquote
              key={review.author}
              className="rounded-2xl border border-border-light bg-bg-card p-6 shadow-card"
            >
              <p className="font-serif text-lg leading-relaxed text-text-primary">
                &ldquo;{review.quote}&rdquo;
              </p>
              <footer className="mt-4 text-sm text-text-muted">
                <cite className="not-italic font-medium text-text-secondary">
                  {review.author}
                </cite>
                <span className="block text-xs">{review.role}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
