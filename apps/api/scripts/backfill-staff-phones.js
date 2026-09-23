const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function norm(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

async function main() {
  const users = await prisma.user.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true },
  });
  let n = 0;
  for (const u of users) {
    const next = norm(u.phone);
    if (next && next !== u.phone && next.length >= 12) {
      try {
        await prisma.user.update({
          where: { id: u.id },
          data: { phone: next },
        });
        n++;
        console.log("fixed", u.phone, "->", next);
      } catch (e) {
        console.log("skip", u.id, u.phone, e.message);
      }
    }
  }
  console.log("updated", n, "of", users.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
