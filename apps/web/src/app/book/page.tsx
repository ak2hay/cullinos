import type { Metadata } from 'next';
import { Suspense } from 'react';
import BookClient from './BookClient';

export const metadata: Metadata = {
  title: 'Book a table | Cullinos',
  description: 'Reserve a table at your restaurant.',
  robots: { index: false, follow: false },
};

export default function BookRoute() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-lg px-4 py-16 text-text-secondary">Loading…</main>
      }
    >
      <BookClient />
    </Suspense>
  );
}
