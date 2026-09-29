-- Backfill customer permissions for existing owner/manager system roles.
INSERT INTO "permissions" ("id", "module", "action", "description", "created_at")
VALUES
  (gen_random_uuid()::text, 'customer', 'read', 'customer:read', NOW()),
  (gen_random_uuid()::text, 'customer', 'create', 'customer:create', NOW()),
  (gen_random_uuid()::text, 'customer', 'update', 'customer:update', NOW())
ON CONFLICT ("module", "action") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid()::text, r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."slug" IN ('owner', 'manager')
  AND p."module" = 'customer'
  AND p."action" IN ('read', 'create', 'update')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
