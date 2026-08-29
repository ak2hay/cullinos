import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { Inter, JetBrains_Mono, Playfair_Display } from 'next/font/google';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingProviders } from '@/components/marketing/MarketingProviders';
import { OrganizationJsonLd } from '@/components/marketing/JsonLd';
import { createMetadata } from '@/lib/metadata';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = createMetadata({});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <OrganizationJsonLd />
      </head>
      <body className="bg-bg-primary text-text-primary antialiased">
        <MarketingProviders>
          <MarketingNav />
          <main>{children}</main>
          <MarketingFooter />
        </MarketingProviders>
        <Analytics />
      </body>
    </html>
  );
}
