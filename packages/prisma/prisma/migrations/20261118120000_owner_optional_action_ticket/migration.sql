-- Platform owners impersonate without a support ticket; the justification is optional.
ALTER TABLE "impersonation_handoffs" ALTER COLUMN "reason" DROP NOT NULL;

-- Super admins left without a platform role stay full owners (god mode, no ticket gate).
UPDATE "users"
SET "platform_role" = 'owner'
WHERE "is_super_admin" = true AND "platform_role" IS NULL;
