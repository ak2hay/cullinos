-- Merged tables stay occupied and point at their primary table until it is freed.

ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "merged_into_table_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tables_merged_into_table_id_fkey'
  ) THEN
    ALTER TABLE "tables"
      ADD CONSTRAINT "tables_merged_into_table_id_fkey"
      FOREIGN KEY ("merged_into_table_id") REFERENCES "tables"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tables_merged_into_table_id_idx" ON "tables"("merged_into_table_id");
