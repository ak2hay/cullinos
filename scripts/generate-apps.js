const fs = require("fs");
const path = require("path");

const apps = [
  { name: "web", port: 5180, title: "Cullinos", subtitle: "Restaurant Operating System" },
  { name: "admin", port: 5181, title: "Cullinos Admin", subtitle: "Owner Dashboard" },
  { name: "management", port: 5182, title: "Cullinos Management", subtitle: "Enterprise Console" },
  { name: "super-admin", port: 5183, title: "Cullinos Super Admin", subtitle: "Platform Operations" },
  { name: "pos", port: 5173, title: "Cullinos POS", subtitle: "Cashier Terminal" },
  { name: "kds", port: 5174, title: "Cullinos KDS", subtitle: "Kitchen Display" },
  { name: "waiter", port: 5175, title: "Cullinos Waiter", subtitle: "Floor Staff" },
  { name: "customer", port: 5176, title: "Cullinos", subtitle: "Order Online" },
];

const root = path.join(__dirname, "..", "apps");

function appTsx(title, subtitle, showPoweredBy) {
  const footer = showPoweredBy
    ? '<footer style={{ marginTop: "3rem", color: cullinosTheme.colors.muted, fontSize: "0.875rem" }}>{poweredByRkyves}</footer>'
    : "";
  return [
    'import { cullinosTheme, poweredByRkyves } from "@cullinos/ui";',
    "",
    "export default function App() {",
    "  return (",
    "    <div style={{ minHeight: '100vh', background: cullinosTheme.colors.charcoal, color: cullinosTheme.colors.white, fontFamily: cullinosTheme.fonts.sans, padding: '2rem' }}>",
    "      <header style={{ borderBottom: '1px solid ' + cullinosTheme.colors.border, paddingBottom: '1rem', marginBottom: '2rem' }}>",
    `        <h1 style={{ color: cullinosTheme.colors.amber, margin: 0 }}>${title}</h1>`,
    `        <p style={{ color: cullinosTheme.colors.muted, margin: '0.5rem 0 0' }}>${subtitle}</p>`,
    "      </header>",
    "      <main>",
    "        <div style={{ background: cullinosTheme.colors.charcoalLight, border: '1px solid ' + cullinosTheme.colors.border, borderRadius: '12px', padding: '2rem' }}>",
    "          <p>Connected to Cullinos API at <code style={{ fontFamily: cullinosTheme.fonts.mono }}>localhost:3000</code></p>",
    "          <p style={{ color: cullinosTheme.colors.muted, marginTop: '1rem' }}>Cullinos v0.1.0</p>",
    "        </div>",
    "      </main>",
    "      " + footer,
    "    </div>",
    "  );",
    "}",
    "",
  ].join("\n");
}

for (const app of apps) {
  const dir = path.join(root, app.name, "src");
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(root, app.name, "package.json"), JSON.stringify({
    name: `@cullinos/${app.name}`,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: `vite --port ${app.port}`,
      build: "tsc && vite build",
      preview: "vite preview",
      typecheck: "tsc --noEmit",
    },
    dependencies: {
      "@cullinos/ui": "*",
      react: "^19.1.0",
      "react-dom": "^19.1.0",
    },
    devDependencies: {
      "@types/react": "^19",
      "@types/react-dom": "^19",
      "@vitejs/plugin-react": "^4.5.2",
      typescript: "^5.8.3",
      vite: "^6.3.5",
    },
  }, null, 2));

  fs.writeFileSync(path.join(root, app.name, "vite.config.ts"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: ${app.port} },
});
`);

  fs.writeFileSync(path.join(root, app.name, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      strict: true,
      skipLibCheck: true,
    },
    include: ["src"],
  }, null, 2));

  fs.writeFileSync(path.join(root, app.name, "index.html"), `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${app.title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`);

  fs.writeFileSync(path.join(dir, "main.tsx"), `import { createRoot } from "react-dom/client";
import App from "./App";
createRoot(document.getElementById("root")!).render(<App />);
`);

  const showPoweredBy = app.name === "customer" || app.name === "web";
  fs.writeFileSync(path.join(dir, "App.tsx"), appTsx(app.title, app.subtitle, showPoweredBy));
}

console.log("Generated", apps.length, "vite apps");
