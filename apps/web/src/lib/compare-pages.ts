/**
 * Competitor rule: name competitors only neutrally. Never state their price, features, gaps, support or ratings.
 */
export interface ComparePage {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  competitors: { name: string; about: string; url: string }[];
  faqs: { q: string; a: string }[];
}

export const COMPARE_LAST_REVIEWED = '14 October 2026';

const PETPOOJA = {
  name: 'Petpooja',
  about: 'Petpooja is a restaurant POS provider in India.',
  url: 'https://www.petpooja.com',
};
const RESTROWORKS = {
  name: 'Restroworks (formerly Posist)',
  about: 'Restroworks, formerly known as Posist, is a restaurant technology provider in India.',
  url: 'https://www.restroworks.com',
};
const DOTPE = {
  name: 'DotPe',
  about: 'DotPe is a restaurant ordering and POS provider in India.',
  url: 'https://www.dotpe.in',
};

export const COMPARE_PAGES: ComparePage[] = [
  {
    slug: 'best-restaurant-pos-software-india',
    title: 'Best Restaurant POS Software in India: How to Choose | Cullinos',
    description:
      'How to choose restaurant POS software in India: the questions to ask any vendor, and what Cullinos, by Rkyves offers. Fit, not rankings.',
    h1: 'Best restaurant POS software in India: how to choose',
    intro:
      'There is no single best restaurant POS for every outlet. The right choice depends on how you take orders, how your kitchen works and how closely you want to track stock and food cost. This page is about fit, not about who is best. It lists the questions to ask any vendor and explains what Cullinos, by Rkyves does, so you can compare on your own terms.',
    competitors: [PETPOOJA, RESTROWORKS, DOTPE],
    faqs: [
      {
        q: 'What should a restaurant POS in India include?',
        a: 'At minimum: fast billing with tax shown on bills, a way to get orders to the kitchen, and a clear view of sales. Many restaurants also want QR table ordering, live stock and food cost in the same system.',
      },
      {
        q: 'Is Cullinos the best POS for every restaurant?',
        a: 'No single POS suits every outlet. Use the checklist on this page, try the systems you shortlist and check each vendor directly.',
      },
      {
        q: 'How do I try Cullinos?',
        a: 'Talk to the Cullinos team through the contact page, or start a free trial from the admin portal.',
      },
    ],
  },
  {
    slug: 'petpooja-alternative',
    title: 'Looking for a Petpooja Alternative? Consider Cullinos',
    description:
      'Considering a Petpooja alternative? See what Cullinos, by Rkyves offers: POS billing, KDS, QR table ordering, live stock and recipe-wise food cost.',
    h1: 'Looking for a Petpooja alternative? Consider Cullinos',
    intro:
      'If you are reviewing your restaurant POS and want to see other options, this page explains what Cullinos, by Rkyves does and the questions worth asking any vendor. It does not rate or compare Petpooja; check their current features and pricing with them directly.',
    competitors: [PETPOOJA],
    faqs: [
      {
        q: 'Can I move from my current POS to Cullinos?',
        a: 'Yes. Talk to the Cullinos team about your menu, outlets and devices, and we will help you plan the switch.',
      },
      {
        q: 'Is this page affiliated with Petpooja?',
        a: 'No. Petpooja is a trademark of its owner. This page only describes Cullinos.',
      },
      {
        q: 'What does Cullinos include?',
        a: 'POS billing, a kitchen display, QR table ordering, live stock with low-stock alerts, a wastage log and recipe-wise food cost, in one login.',
      },
    ],
  },
  {
    slug: 'cullinos-vs-posist',
    title: 'Cullinos vs Posist (Restroworks): What to Compare | Cullinos',
    description:
      'Comparing Cullinos and Posist (Restroworks)? The questions to ask, and what Cullinos, by Rkyves offers for restaurants across India.',
    h1: 'Cullinos vs Posist (Restroworks): what to compare',
    intro:
      'If you are weighing Cullinos against Posist, now Restroworks, this page lists what to compare and explains what Cullinos, by Rkyves does. It makes no claims about Restroworks; check their current features and pricing with them directly.',
    competitors: [RESTROWORKS],
    faqs: [
      {
        q: 'Are Posist and Restroworks the same company?',
        a: 'Restroworks is the current name of the company formerly known as Posist. Check their website for current details.',
      },
      {
        q: 'Is this page affiliated with Restroworks?',
        a: 'No. Restroworks and Posist are trademarks of their owner. This page only describes Cullinos.',
      },
      {
        q: 'How do I see Cullinos in action?',
        a: 'Talk to the Cullinos team through the contact page and we will walk you through it.',
      },
    ],
  },
  {
    slug: 'dotpe-alternative',
    title: 'DotPe Alternative for QR Ordering & POS | Cullinos',
    description:
      'Looking at DotPe alternatives for QR ordering and POS? See how Cullinos, by Rkyves sends QR table orders to the same kitchen queue as your POS.',
    h1: 'DotPe alternative for QR ordering and POS',
    intro:
      'If you are exploring QR ordering and POS options alongside DotPe, this page explains what Cullinos, by Rkyves does and what to ask any vendor. It does not rate or compare DotPe; check their current features and pricing with them directly.',
    competitors: [DOTPE],
    faqs: [
      {
        q: 'Where do Cullinos QR orders go?',
        a: 'QR table orders land on the Cullinos kitchen display in the same queue as POS orders, and on the table bill.',
      },
      {
        q: 'Is this page affiliated with DotPe?',
        a: 'No. DotPe is a trademark of its owner. This page only describes Cullinos.',
      },
      {
        q: 'Do guests need an app to order by QR?',
        a: 'No. Scanning the table QR code opens your menu in the phone browser.',
      },
    ],
  },
];

export const VENDOR_CHECKLIST = [
  'Does it include a kitchen display (KDS), or only printed KOTs?',
  'Do QR table orders go into the same kitchen queue as POS orders?',
  'Can you see live stock and get low-stock alerts?',
  'Is there a wastage log?',
  'Can you see recipe-wise food cost for each dish?',
  'What hardware do you need, and can you use devices you already own?',
  'Who handles onboarding, and how long does setup take?',
  'What are the contract terms, and how do you export your data if you leave?',
];

export function getComparePage(slug: string): ComparePage | undefined {
  return COMPARE_PAGES.find((p) => p.slug === slug);
}
