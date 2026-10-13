/** Only confirmed features. Never claim automatic stock deduction, split bills, stats, clients or delivery apps here. */
export interface FeaturePage {
  slug: string;
  name: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: { heading: string; paragraphs: string[] }[];
  faqs: { q: string; a: string }[];
  related: string;
}

export const FEATURE_PAGES: FeaturePage[] = [
  {
    slug: 'restaurant-pos',
    name: 'Restaurant POS billing',
    title: 'Restaurant POS Billing Software for India | Cullinos',
    description:
      'Cullinos, by Rkyves: fast restaurant POS billing linked to your kitchen display, QR table orders and live stock, for restaurants across India.',
    h1: 'Restaurant POS billing software for India',
    intro:
      'Cullinos POS is the billing counter of Cullinos, by Rkyves. It is built for busy Indian restaurants, cafés and food businesses that want fast bills, clear tax on every receipt and a kitchen that sees each order the moment it is punched in.',
    sections: [
      {
        heading: 'What POS billing does',
        paragraphs: [
          'A point of sale is where every order becomes a bill. In Cullinos the cashier picks items from your menu on a touch screen, adds modifiers and notes, applies a discount if you allow it, and settles the bill. The menu, prices and tax groups come from your admin dashboard, so the counter never runs on an old price list that someone forgot to update.',
          'The POS runs in a modern browser on a PC, laptop or tablet, so you do not need special hardware to start. Thermal receipt printers and cash drawers connect through the Cullinos Local Gateway, which also keeps billing running when your internet connection drops and syncs once you are back online.',
          'Tax is set up once, not calculated by hand. You create tax groups such as CGST + SGST, assign them to menu items, and every bill shows the breakdown. Your accountant still confirms the rates and handles filings; Cullinos does not file returns for you.',
        ],
      },
      {
        heading: 'Bills linked to the kitchen',
        paragraphs: [
          'Every item that goes on a bill also goes to the kitchen. When the cashier sends an order, it appears on the Cullinos kitchen display (KDS) instead of a paper KOT that can be lost, smudged or misread. Cooks see what to make, the counter sees when it is ready, and nobody has to shout across the pass.',
          'Orders placed by guests through QR table ordering land in the same queue as counter orders. That means one list for the kitchen, one set of bills for the cashier and no double entry between a tablet on the wall and the billing machine.',
        ],
      },
      {
        heading: 'Bills linked to stock',
        paragraphs: [
          'Billing and inventory live in the same system. Your live stock view, low-stock alerts and wastage log sit next to the sales your POS records, so the person counting stock in the morning and the person billing at night work from the same numbers.',
          'Because recipes and food cost are in Cullinos as well, you can look at what sold and what each dish costs to make in one login, instead of copying figures from the billing software into a spreadsheet at the end of the month.',
        ],
      },
      {
        heading: 'Who it suits',
        paragraphs: [
          'Cullinos POS suits single-outlet restaurants, cafés, quick-service counters and growing groups across India. If you run more than one outlet, each outlet keeps its own devices, menu prices and settings, managed from one admin account.',
          'Cash is always available at the counter. For UPI and cards, you connect your own payment gateway account in settings, and online tender stays off until a gateway is configured for that outlet. The admin portal is available in English, Hindi and eight other Indian languages, so owners and managers can work in the language they prefer.',
          'Getting started is simple: add your menu, tables, staff and tax groups in the admin dashboard, open the POS in a browser and take your first bill. Plans start with a 30-day free trial, and our team can help you set up your first outlet if you would rather not do it alone.',
        ],
      },
    ],
    faqs: [
      {
        q: 'What devices do I need for Cullinos POS?',
        a: 'A PC, laptop or tablet with a modern browser. Receipt printers and cash drawers connect through the Local Gateway.',
      },
      {
        q: 'Does the POS work when the internet is down?',
        a: 'Yes. The Local Gateway keeps POS and kitchen display running offline and syncs when the connection returns.',
      },
      {
        q: 'How is GST shown on bills?',
        a: 'You set up tax groups such as CGST + SGST and assign them to items. Each bill shows the breakdown. Your accountant confirms rates and handles filings.',
      },
      {
        q: 'Can guests pay by UPI?',
        a: 'Yes, once you connect your own payment gateway account in settings. Cash is always available at the POS.',
      },
    ],
    related: 'kitchen-display-system',
  },
  {
    slug: 'kitchen-display-system',
    name: 'Kitchen display system (KDS)',
    title: 'Kitchen Display System (KDS) for Restaurants | Cullinos',
    description:
      'Replace paper KOTs with a kitchen display. Orders from the POS and QR tables appear on screen instantly with Cullinos, by Rkyves.',
    h1: 'Kitchen display system (KDS) for restaurants',
    intro:
      'The Cullinos kitchen display replaces paper KOTs with a screen in your kitchen. Orders from the POS and from QR table ordering appear instantly, grouped and timed, so your cooks always know what to make next.',
    sections: [
      {
        heading: 'Why paper KOTs fail',
        paragraphs: [
          'A kitchen order ticket on paper works until the kitchen gets busy. Tickets fall behind the counter, get splashed with oil, or are read in the wrong order. A handwritten change such as "no onion" is easy to miss, and nobody knows how long a table has been waiting until the guest asks.',
          'Paper also gives the floor team no view of the kitchen. Servers walk back and forth to ask whether an order is ready, and the cashier has no way of knowing that a dish is stuck. In a full service, these small delays add up to cold food and unhappy guests.',
        ],
      },
      {
        heading: 'How Cullinos KDS works',
        paragraphs: [
          'When an order is sent from the Cullinos POS, or placed by a guest through QR table ordering, it appears on the kitchen display straight away. Each ticket shows the table or order number, the items, modifiers and notes, and how long ago it came in.',
          'Cooks mark items as they are prepared and mark the order ready when it is done. The floor and counter can see that status, so servers pick up food when it is ready instead of guessing. Because every channel lands in the same queue, the kitchen works from one list rather than a printer for each source.',
          'The display runs in a modern browser on a tablet, a TV with a small PC, or any screen you already have. Through the Local Gateway it keeps working during internet drops and syncs once you are back online, so a flaky connection does not stop service.',
        ],
      },
      {
        heading: 'Station setup',
        paragraphs: [
          'Most kitchens have more than one station: a tandoor, a curry section, a fryer, a beverage counter. Cullinos lets you route orders to stations so each screen shows only what that station needs to make. The tandoor does not scroll past milkshakes, and the bar does not see the biryani.',
          'You decide which menu items go to which station in the admin dashboard. When you add a new dish, you assign its station once, and every future order follows that rule. If you reorganise your kitchen, you change the mapping in one place.',
        ],
      },
      {
        heading: 'Rollout steps',
        paragraphs: [
          'Start with one screen at your busiest station and keep paper as a backup for the first few services. Once the team trusts the screen, add the other stations and retire the KOT printer.',
          'Train cooks on two actions only: marking items prepared and marking the order ready. Ask servers to check the ready status before they walk to the pass. Most teams settle in within a week, and the kitchen gets noticeably calmer in rush hour.',
          'Review your ticket times after the first month. If one station is always slow, the display makes it visible, so you can move staff, simplify a dish or change your prep before service.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Which orders appear on the Cullinos kitchen display?',
        a: 'Orders sent from the Cullinos POS and orders placed through QR table ordering, all in one queue.',
      },
      {
        q: 'What screen do I need for KDS?',
        a: 'Any screen that can run a modern browser, such as a tablet or a TV connected to a small PC.',
      },
      {
        q: 'Can I split orders by kitchen station?',
        a: 'Yes. You assign menu items to stations in the admin dashboard, and each station screen shows only its items.',
      },
      {
        q: 'Does KDS keep working offline?',
        a: 'Yes. Through the Local Gateway it keeps running during internet drops and syncs once the connection is back.',
      },
    ],
    related: 'qr-ordering',
  },
  {
    slug: 'qr-ordering',
    name: 'QR table ordering',
    title: 'QR Table Ordering for Restaurants | Cullinos',
    description:
      'Guests scan, browse and order from the table. Orders go straight to the Cullinos kitchen display and POS. Built for restaurants across India.',
    h1: 'QR code table ordering for restaurants',
    intro:
      'With Cullinos QR table ordering, guests scan a code on their table, browse your menu on their phone and place an order. The order goes straight to your kitchen display and POS, with no extra app for the guest to install.',
    sections: [
      {
        heading: 'How QR table ordering works',
        paragraphs: [
          'Each table gets its own QR code, generated from the Cullinos admin dashboard. You print it on a table tent or sticker. When a guest scans it, their phone opens your menu in the browser, already linked to that table.',
          'The guest picks items, adds notes such as "less spicy", and places the order. There is no app to download and no account to create, which matters for walk-in guests who just want to eat. Staff can still take orders the usual way for guests who prefer to talk to a server.',
          'Because the code knows the table, the kitchen and the floor team see exactly where each order came from. Servers no longer have to write table numbers on tickets, and a busy section does not mean slow ordering.',
        ],
      },
      {
        heading: 'From table to kitchen',
        paragraphs: [
          'A QR order is not a message that someone must re-type into the billing system. It lands on the Cullinos kitchen display in the same queue as orders from the counter, and it is attached to the table on the POS so the bill is ready when the guest asks for it.',
          'This removes the most common QR ordering problem: a separate tablet or dashboard that staff must watch and copy from. In Cullinos there is one queue, one bill per table and one view of what the kitchen is making.',
          'When the guest wants to pay, the cashier settles the table bill at the POS as usual. Cash is always available, and UPI and cards work once you connect your own payment gateway account.',
        ],
      },
      {
        heading: 'Menu in one place',
        paragraphs: [
          'The QR menu comes from the same menu you manage for the POS. When you change a price, add a dish or mark an item as unavailable in the admin dashboard, the QR menu shows it too. Guests never order a dish that ran out an hour ago, and you never maintain two menus.',
          'Categories, item descriptions, modifiers and images all come from your back office. If you run more than one outlet, each outlet can have its own prices and availability while sharing the same menu structure.',
          'QR ordering works alongside your floor staff rather than replacing them. Many restaurants use it at peak times so servers can focus on service, refills and guests who need help choosing.',
        ],
      },
      {
        heading: 'Getting started with QR ordering',
        paragraphs: [
          'Start with your menu. Make sure every item has a clear name, a short description and the right price in the Cullinos admin dashboard, because that is exactly what guests will see on their phones. Then generate a QR code for each table and print it where guests can scan it easily.',
          'Run a test order from each table before your first service, and check that it appears on the kitchen display and on the right table bill. Tell your team which tables are live so they can help guests who have questions. After a week, look at which tables and times use QR ordering most and adjust your staffing to match.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Do guests need to download an app to order by QR?',
        a: 'No. Scanning the table QR code opens your menu in the phone browser.',
      },
      {
        q: 'Where do QR orders go?',
        a: 'Straight to the Cullinos kitchen display and onto the table bill in the POS, in the same queue as counter orders.',
      },
      {
        q: 'Is the QR menu separate from my POS menu?',
        a: 'No. It is the same menu, so price and availability changes show everywhere at once.',
      },
      {
        q: 'Can my staff still take orders the normal way?',
        a: 'Yes. QR ordering runs alongside the POS, so staff can take orders for any guest who prefers it.',
      },
    ],
    related: 'restaurant-pos',
  },
  {
    slug: 'inventory-management',
    name: 'Inventory, live stock and wastage',
    title: 'Restaurant Inventory, Live Stock & Low-Stock Alerts | Cullinos',
    description:
      'Track live stock, get low-stock alerts and log wastage in Cullinos, by Rkyves, so you stop running out mid-service.',
    h1: 'Restaurant inventory management: live stock, low-stock alerts and wastage',
    intro:
      'Cullinos inventory gives your restaurant a live view of stock, alerts before you run low and a simple wastage log. It sits in the same login as your POS and kitchen display, so stock is no longer a separate spreadsheet.',
    sections: [
      {
        heading: 'Live stock view',
        paragraphs: [
          'Running out of paneer in the middle of Saturday dinner is rarely a surprise in hindsight. The stock was low on Thursday, but nobody looked. Cullinos shows your current stock for each ingredient and item in one list, so the manager can see what is on the shelf without walking into the store room with a notebook.',
          'You record purchases and stock counts in the admin dashboard, and the live view updates. Each outlet keeps its own stock, so a group with several kitchens can see where an item is short and where there is extra.',
          'Keep the list focused. Track the ingredients that cost the most or run out most often first, such as proteins, dairy, oil and packaging, and add the rest once the habit of updating stock is in place. A short list that is always accurate is worth more than a long one nobody trusts.',
        ],
      },
      {
        heading: 'Low-stock alerts',
        paragraphs: [
          'For each item you set a minimum level that makes sense for your kitchen, for example five kilos of onions or two cases of milk. When stock falls below that level, Cullinos flags it as low so the person placing orders sees it before service, not during it.',
          'Alerts work best when the minimum matches how fast you use an item and how long your supplier takes to deliver. Start with a rough number, watch it for two weeks and adjust. A good minimum means fewer emergency runs to the market and less cash tied up in stock you do not need.',
        ],
      },
      {
        heading: 'Wastage log',
        paragraphs: [
          'Food that is spoiled, dropped, over-prepared or returned is still a cost, even though it never reaches a bill. The Cullinos wastage log lets your team record what was thrown away, how much and why, in a few taps.',
          'Over a month the log shows patterns: the same dish over-prepared every Monday, a supplier whose vegetables spoil early, a fridge that is not holding temperature. Those are problems you can fix once you can see them, and the wastage figures also feed into a more honest food cost.',
        ],
      },
      {
        heading: 'Weekly stock routine',
        paragraphs: [
          'A simple routine keeps the numbers useful. At the start of the week, count your high-value and fast-moving items and update stock. Review low-stock alerts every morning before placing orders. Ask the kitchen to log wastage at the end of every shift, not from memory at the end of the month.',
          'Once a week, compare what you bought, what you used and what you wasted. Big gaps usually point to portioning, theft or missing entries. Because Cullinos keeps sales, stock and wastage in one place, this check takes minutes rather than an afternoon with spreadsheets.',
          'If you also set up recipes in Cullinos, the same data lets you see recipe-wise food cost, which turns a stock list into a tool for pricing your menu.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can I see stock for each outlet separately?',
        a: 'Yes. Each outlet keeps its own stock, and you manage all of them from one admin account.',
      },
      {
        q: 'How do low-stock alerts work?',
        a: 'You set a minimum level for each item. When stock falls below it, Cullinos flags the item as low.',
      },
      {
        q: 'Why should I log wastage?',
        a: 'Wastage is a real cost that never shows on a bill. Logging it shows patterns you can fix and gives you a more accurate food cost.',
      },
      {
        q: 'Is inventory a separate app?',
        a: 'No. Inventory sits in the same Cullinos login as your POS, kitchen display and recipes.',
      },
    ],
    related: 'recipe-management',
  },
  {
    slug: 'recipe-management',
    name: 'Recipe-wise food cost',
    title: 'Recipe-Wise Food Cost Software for Restaurants | Cullinos',
    description:
      'See what every dish costs to make. Recipe-wise food cost in Cullinos, by Rkyves, helps restaurants across India price menus and cut waste.',
    h1: 'Recipe-wise food cost software for restaurants',
    intro:
      'Cullinos recipe management shows what every dish on your menu costs to make. Build recipe cards from your ingredients, see the food cost of each plate and use those numbers to price your menu with confidence.',
    sections: [
      {
        heading: 'Food cost percentage explained',
        paragraphs: [
          'Food cost percentage is the cost of the ingredients in a dish divided by its menu price. If a paneer tikka costs ₹90 in ingredients and sells for ₹300, its food cost is 30 percent. Most restaurants watch this number closely because it is the biggest cost they can control day to day.',
          'The problem is that few kitchens know the real number for each dish. Ingredient prices change every week, portions drift, and the costing sheet made at launch is long out of date. A dish that looked profitable a year ago may now barely cover its ingredients.',
        ],
      },
      {
        heading: 'Recipe cards and base preparations',
        paragraphs: [
          'In Cullinos you build a recipe card for each menu item from the ingredients in your inventory: how many grams of chicken, how much oil, how much of each spice. The food cost is worked out from the ingredient costs you hold in the system.',
          'Many dishes share base preparations such as a makhani gravy, a dough or a marinade. You can cost a base preparation once and use it inside other recipes, so when the price of butter goes up, every dish that uses the gravy reflects it.',
          'Recipe cards also help consistency. New cooks can see the standard portion for each dish, which keeps both taste and cost steady across shifts.',
        ],
      },
      {
        heading: 'Costing with wastage',
        paragraphs: [
          'A recipe card tells you what a dish should cost. Your wastage log tells you what you actually lose along the way. Looking at both together gives a more honest picture: a dish with a low recipe cost but heavy daily wastage may be less profitable than it looks.',
          'Because inventory, wastage and recipes are in the same Cullinos login, you do not need to match numbers across separate tools to see this.',
          'Trim and yield matter too. A kilo of whole chicken does not give a kilo of usable meat, and onions lose weight when peeled. Write your recipe quantities in the amount you actually buy, or note the yield, so the cost on the card matches what you pay your supplier.',
        ],
      },
      {
        heading: 'Keeping costs up to date',
        paragraphs: [
          'A recipe cost is only as good as the ingredient prices behind it. When you record purchases in Cullinos with the price you paid, your ingredient costs stay current, and so do the recipe cards that use them. Make it part of receiving stock: check the bill, enter the quantities and prices, and the costing follows.',
        ],
      },
      {
        heading: 'Menu decisions',
        paragraphs: [
          'With recipe-wise food cost in front of you, menu decisions become simpler. Raise the price of a popular dish whose cost has crept up. Rework a recipe that uses an expensive ingredient for little benefit. Promote dishes with a healthy margin, and consider dropping slow sellers that are expensive to prepare.',
          'Review your food cost every month, and every time a key ingredient changes price. A short monthly review of your top twenty dishes usually covers most of your sales and keeps your margins where you planned them.',
          'If you are just starting, cost your ten best-selling dishes first. That alone often shows where most of your margin is won or lost.',
        ],
      },
    ],
    faqs: [
      {
        q: 'What is recipe-wise food cost?',
        a: 'The cost of the ingredients in each dish, worked out from its recipe card, shown next to its menu price.',
      },
      {
        q: 'Can one preparation be used in many recipes?',
        a: 'Yes. Cost a base preparation such as a gravy once and use it inside other recipes.',
      },
      {
        q: 'How often should I review food cost?',
        a: 'Every month, and whenever a key ingredient changes price. Start with your best-selling dishes.',
      },
    ],
    related: 'inventory-management',
  },
];

export const FEATURE_PAGE_SLUGS = FEATURE_PAGES.map((p) => p.slug);

export function getFeaturePage(slug: string): FeaturePage | undefined {
  return FEATURE_PAGES.find((p) => p.slug === slug);
}

export function featurePageWordCount(page: FeaturePage): number {
  const text = [
    page.intro,
    ...page.sections.flatMap((s) => [s.heading, ...s.paragraphs]),
    ...page.faqs.flatMap((f) => [f.q, f.a]),
  ].join(' ');
  return text.split(/\s+/).filter(Boolean).length;
}
