const fs = require("fs");
const path = require("path");

const modulesDir = path.join(__dirname, "..", "apps", "api", "src", "modules");

const fixes = [
  { file: "insights/insights.service.ts", content: `import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class InsightsService {
  constructor(private prisma: PrismaService) {}
  list(_orgId: string) {
    return this.prisma.insightsSnapshot.findMany({ take: 200 });
  }
}
` },
  { file: "tables/tables.service.ts", content: `import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TablesService {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.table.findMany({
      where: { section: { floor: { outlet: { organizationId: orgId } } } },
      include: { section: true },
      take: 200,
    });
  }
}
` },
];

for (const { file, content } of fixes) {
  fs.writeFileSync(path.join(modulesDir, file), content);
}

// Remove orderBy createdAt from all service files
for (const dir of fs.readdirSync(modulesDir)) {
  const servicePath = path.join(modulesDir, dir, `${dir}.service.ts`);
  if (!fs.existsSync(servicePath)) continue;
  let text = fs.readFileSync(servicePath, "utf8");
  text = text.replace(/orderBy: \{ createdAt: "desc" \}/g, "");
  text = text.replace(/,\s*take: 200/g, ", take: 200");
  fs.writeFileSync(servicePath, text);
}

console.log("Fixed service files");
