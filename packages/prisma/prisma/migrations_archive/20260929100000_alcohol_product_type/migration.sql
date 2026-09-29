-- Mark previously imported bar catalog items as alcohol so KOT routing, guest ordering rules and menu visibility apply
UPDATE "menu_items"
SET "product_type" = 'alcohol'
WHERE "catalog_item_id" IS NOT NULL
  AND split_part("catalog_item_id", '.', 1) IN (
    'whisky', 'vodka', 'rum', 'gin', 'tequila', 'brandy', 'liqueur', 'wine', 'beer', 'rtd', 'cocktails'
  );
