# Archived migrations

These were applied on top of a database created with `prisma db push`, so they cannot
build a database from empty. They are kept for history only and are not read by Prisma.

`../migrations/0_init` is the baseline generated with
`prisma migrate diff --from-empty --to-schema-datamodel schema.prisma --script`.
See `docs/DEPLOYMENT.md` → "Database migrations" for baselining an existing database.
