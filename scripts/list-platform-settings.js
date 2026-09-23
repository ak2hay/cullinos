const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

const env = {};
for (const line of fs.readFileSync("A:/cullinos/.env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
process.env.DATABASE_URL = env.DATABASE_URL;

(async () => {
  const prisma = new PrismaClient();
  const rows = await prisma.platformSetting.findMany({
    select: { key: true, isSecret: true, value: true, valueEnc: true },
    orderBy: { key: "asc" },
  });
  console.log("count=" + rows.length);
  for (const r of rows) {
    const has = r.valueEnc ? "enc" : r.value ? "val" : "empty";
    const preview =
      !r.isSecret && r.value ? "=" + String(r.value).slice(0, 48) : "";
    console.log(`${r.key}|secret=${r.isSecret}|${has}${preview}`);
  }
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
