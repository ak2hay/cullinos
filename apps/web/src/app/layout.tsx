import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { OrganizationJsonLd } from '@/components/marketing/JsonLd';
import { createMetadata } from '@/lib/metadata';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = createMetadata({});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <OrganizationJsonLd />
      </head>
      <body>
        <MarketingNav />
        <main>{children}</main>
        <MarketingFooter />
        <Analytics />
      </body>
    </html>
  );
}
