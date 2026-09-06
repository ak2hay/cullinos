import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Playfair_Display } from 'next/font/google';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingProviders } from '@/components/marketing/MarketingProviders';
import { MarketingCmsProvider } from '@/components/marketing/MarketingCmsProvider';
import { MarketingThemeStyles } from '@/components/marketing/MarketingThemeStyles';
import { MarketingChromeExtras } from '@/components/marketing/MarketingChromeExtras';
import { CloudflareAnalytics } from '@/components/marketing/CloudflareAnalytics';
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/marketing/JsonLd';
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

export const metadata: Metadata = {
  ...createMetadata({}),
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cms = await getMarketingContent();

  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable}`}>
      <head>
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        <MarketingThemeStyles theme={cms.theme} />
      </head>
      <body className="bg-bg-primary text-text-primary antialiased pb-20 md:pb-0">
        <MarketingCmsProvider initialData={cms}>
          <MarketingProviders>
            <MarketingNav />
            <main>{children}</main>
            <MarketingFooter />
            <MarketingChromeExtras />
          </MarketingProviders>
        </MarketingCmsProvider>
        <CloudflareAnalytics />
      </body>
    </html>
  );
}
