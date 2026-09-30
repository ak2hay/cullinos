# Cullinos Client Documents

Stylish PDFs for customers, prospects, and restaurant teams.

## Documents

| PDF | Audience | Purpose |
|-----|----------|---------|
| **Cullinos_Brochure.pdf** | Prospects / clients | Short sales brochure — what we offer |
| **Cullinos_Product_Overview.pdf** | Decision makers | What Cullinos is, every feature, plans |
| **Cullinos_User_Manual.pdf** | Owners & staff | How to use the platform day to day |
| **Cullinos_Plans_Brochure.pdf** | Prospects / decision makers | Plan chooser, a page per plan, comparison matrix, custom quotes |
| **plans/Cullinos_Plan_&lt;Name&gt;.pdf** | A specific prospect | One-page sheet per plan: Starter, QSR, Professional, Enterprise, Hospitality |

Plan prices, limits, and features are rendered from the `PLANS` constant in the generator, which mirrors `PUBLIC_PLAN_CATALOG` / `PLAN_FEATURES` in `packages/shared/src/features.ts`. Update both together when pricing changes.

Full internal feature reference (markdown): [../PRODUCT.md](../PRODUCT.md).

## What’s covered (2026-09 refresh)

- POS, Portal POS, KDS, CDS, promo display, Waiter, tables, reservations  
- QR / online storefront, kiosk, **Cullinos Guest** marketplace app  
- Purchasing, suppliers, central kitchen, production, ERP export  
- CRM, loyalty, coupons, promo email, SMS, aggregators (Swiggy/Zomato)  
- Guest banners / push, multi-outlet, hospitality  

## Generate

From repo root:

```bash
npm run client:export
```

Source: `scripts/generate-client-pdfs.mjs`

Outputs:

- `docs/client/export/pdf/` — share these  
- `docs/client/export/html/` — preview / reprint if needed  

## Share checklist

1. Brochure → first touch / email attachment  
2. Product Overview → demos & proposals  
3. Plans Brochure → pricing conversations; per-plan sheet → follow-up after a demo  
4. User Manual → after onboarding  
5. (Optional) Link decision-makers to the detailed [PRODUCT.md](../PRODUCT.md) for engineers / deep diligence  

Contact: hello@rkyves.com · https://cullinos.com · Mumbai, India
