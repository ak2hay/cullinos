-- Unique permanent table QR codes (nullable unique)
CREATE UNIQUE INDEX IF NOT EXISTS "tables_qr_code_key" ON "tables"("qr_code");

-- Restaurant gallery photos for guest app / menu
CREATE TABLE IF NOT EXISTS "outlet_photos" (
    "id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outlet_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "outlet_photos_outlet_id_sort_order_idx" ON "outlet_photos"("outlet_id", "sort_order");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'outlet_photos_outlet_id_fkey'
  ) THEN
    ALTER TABLE "outlet_photos"
      ADD CONSTRAINT "outlet_photos_outlet_id_fkey"
      FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
