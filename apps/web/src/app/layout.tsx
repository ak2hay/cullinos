import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { Inter, JetBrains_Mono, Playfair_Display } from 'next/font/google';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingProviders } from '@/components/marketing/MarketingProviders';
import { MarketingCmsProvider } from '@/components/marketing/MarketingCmsProvider';
import { MarketingThemeStyles } from '@/components/marketing/MarketingThemeStyles';
import { OrganizationJsonLd } from '@/components/marketing/JsonLd';
import { createMetadata } from '@/lib/metadata';
import { getMarketingContent } from '@/lib/marketing-content';
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cms = await getMarketingContent();

  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <OrganizationJsonLd />
        <MarketingThemeStyles theme={cms.theme} />
      </head>
      <body className="bg-bg-primary text-text-primary antialiased">
        <MarketingCmsProvider initialData={cms}>
          <MarketingProviders>
            <MarketingNav />
            <main>{children}</main>
            <MarketingFooter />
          </MarketingProviders>
        </MarketingCmsProvider>
        <Analytics />
      </body>
    </html>
  );
}
