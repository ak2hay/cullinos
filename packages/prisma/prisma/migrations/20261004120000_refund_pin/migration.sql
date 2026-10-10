-- AlterTable
ALTER TABLE "users" ADD COLUMN     "refund_pin_hash" TEXT,
ADD COLUMN     "refund_pin_failed_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refund_pin_locked_until" TIMESTAMP(3);

-- Grant order:refund to existing owner and manager system roles.
INSERT INTO "permissions" ("id", "module", "action", "description", "created_at")
VALUES (gen_random_uuid()::text, 'order', 'refund', 'order:refund', CURRENT_TIMESTAMP)
ON CONFLICT ("module", "action") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid()::text, r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."slug" IN ('owner', 'manager')
  AND r."is_system" = true
  AND p."module" = 'order'
  AND p."action" = 'refund'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
