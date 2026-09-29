-- Run against an existing (db-push managed) database BEFORE applying the catch-up diff
-- and `prisma migrate resolve --applied 0_init`. Every query must return zero rows.

-- New unique: payments(organization_id, reference)
SELECT organization_id, reference, COUNT(*) AS n
FROM payments
WHERE reference IS NOT NULL
GROUP BY organization_id, reference
HAVING COUNT(*) > 1;

-- New unique: coupon_usages(coupon_id, order_id)
SELECT coupon_id, order_id, COUNT(*) AS n
FROM coupon_usages
WHERE order_id IS NOT NULL
GROUP BY coupon_id, order_id
HAVING COUNT(*) > 1;

-- New unique: invoices(organization_id, invoice_number) after backfill below
SELECT o.organization_id, i.invoice_number, COUNT(*) AS n
FROM invoices i
JOIN orders o ON o.id = i.order_id
GROUP BY o.organization_id, i.invoice_number
HAVING COUNT(*) > 1;

-- Backfills to run AFTER the catch-up diff has added the new columns:
--   UPDATE invoices i SET organization_id = o.organization_id
--     FROM orders o WHERE o.id = i.order_id AND i.organization_id IS NULL;
--   UPDATE credit_notes c SET organization_id = i.organization_id
--     FROM invoices i WHERE i.id = c.invoice_id AND c.organization_id IS NULL;
