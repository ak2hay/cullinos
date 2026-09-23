# Cullinos Client Documents

Stylish PDFs for customers, prospects, and restaurant teams.

## Documents

| PDF | Audience | Purpose |
|-----|----------|---------|
| **Cullinos_Brochure.pdf** | Prospects / clients | Short sales brochure — what we offer |
| **Cullinos_Product_Overview.pdf** | Decision makers | What Cullinos is, every feature, plans |
| **Cullinos_User_Manual.pdf** | Owners & staff | How to use the platform day to day |

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
3. User Manual → after onboarding  
4. (Optional) Link decision-makers to the detailed [PRODUCT.md](../PRODUCT.md) for engineers / deep diligence  

Contact: hello@rkyves.com · https://cullinos.com · Mumbai, India
