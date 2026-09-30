-- Marketing pricing cards (draft + published): prices in paise
UPDATE "marketing_pricing_cards"
SET "price_monthly" = 149900, "price_yearly" = 1499900, "updated_at" = NOW()
WHERE "plan_key" = 'STARTER';

UPDATE "marketing_pricing_cards"
SET "price_monthly" = 249900, "price_yearly" = 2499900, "updated_at" = NOW()
WHERE "plan_key" = 'QSR';

UPDATE "marketing_pricing_cards"
SET "price_monthly" = 499900, "price_yearly" = 4999900, "updated_at" = NOW()
WHERE "plan_key" = 'PROFESSIONAL';

UPDATE "marketing_pricing_cards"
SET "price_monthly" = 0,
    "price_yearly" = 0,
    "cta" = 'contact',
    "description" = 'Custom pricing based on outlets, POS terminals, users, integrations and requirements.',
    "updated_at" = NOW()
WHERE "plan_key" = 'ENTERPRISE';

UPDATE "marketing_pricing_cards"
SET "price_monthly" = 0,
    "price_yearly" = 0,
    "cta" = 'contact',
    "description" = 'Custom pricing based on rooms, outlets, terminals and integrations.',
    "updated_at" = NOW()
WHERE "plan_key" = 'HOSPITALITY';
