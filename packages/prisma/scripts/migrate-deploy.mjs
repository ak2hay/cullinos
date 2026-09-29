#!/usr/bin/env node
// Applies Prisma migrations, refusing to touch a db-push-managed database that has not
// been baselined (it would otherwise try to run 0_init on top of existing tables).
// Usage (from repo root): node packages/prisma/scripts/migrate-deploy.mjs
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = path.resolve(here, '../prisma/schema.prisma');

async function baselineState() {
  const prisma = new PrismaClient();
  try {
    const [{ has_orgs: hasOrgs, has_history: hasHistory }] = await prisma.$queryRaw`
      SELECT to_regclass('public.organizations') IS NOT NULL AS has_orgs,
             to_regclass('public._prisma_migrations') IS NOT NULL AS has_history`;
    if (!hasOrgs) return 'empty';
    if (!hasHistory) return 'unbaselined';
    const rows = await prisma.$queryRaw`
      SELECT 1 FROM _prisma_migrations
      WHERE migration_name = '0_init' AND finished_at IS NOT NULL AND rolled_back_at IS NULL
      LIMIT 1`;
    return rows.length > 0 ? 'baselined' : 'unbaselined';
  } finally {
    await prisma.$disconnect();
  }
}

const state = await baselineState();
if (state === 'unbaselined') {
  console.error(
    'Refusing to migrate: the database has tables but 0_init is not recorded as applied.\n' +
      'Follow docs/DEPLOYMENT.md -> "Baselining an existing database" first.',
  );
  process.exit(3);
}

console.log(`Database state: ${state}. Running prisma migrate deploy...`);
const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy', `--schema=${schema}`], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
