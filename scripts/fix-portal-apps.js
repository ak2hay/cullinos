const fs = require('fs');
const path = require('path');

const portals = [
  { name: 'admin', port: 5181, extraDeps: {} },
  { name: 'management', port: 5182, extraDeps: {} },
  { name: 'super-admin', port: 5183, extraDeps: {} },
  { name: 'pos', port: 5173, extraDeps: {} },
  { name: 'kds', port: 5174, extraDeps: { 'socket.io-client': '^4.8.1' } },
  { name: 'waiter', port: 5175, extraDeps: {} },
  { name: 'customer', port: 5176, extraDeps: {} },
];

const root = path.join(__dirname, '..', 'apps');
const portalTsconfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'portal-tsconfig.json'), 'utf8'),
);

const baseDeps = {
  '@cullinos/shared': '*',
  '@cullinos/ui': '*',
  '@tanstack/react-query': '^5.64.2',
  react: '^19.1.0',
  'react-dom': '^19.1.0',
  'react-router-dom': '^7.1.1',
  zustand: '^5.0.3',
};

for (const portal of portals) {
  const appDir = path.join(root, portal.name);

  fs.writeFileSync(
    path.join(appDir, 'package.json'),
    JSON.stringify(
      {
        name: `@cullinos/${portal.name}`,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
          dev: `vite --port ${portal.port}`,
          build: 'tsc && vite build',
          preview: 'vite preview',
          typecheck: 'tsc --noEmit',
        },
        dependencies: {
          ...baseDeps,
          ...portal.extraDeps,
        },
        devDependencies: {
          '@types/react': '^19',
          '@types/react-dom': '^19',
          '@vitejs/plugin-react': '^4.5.2',
          typescript: '^5.8.3',
          vite: '^6.3.5',
        },
      },
      null,
      2,
    ) + '\n',
  );

  fs.writeFileSync(
    path.join(appDir, 'tsconfig.json'),
    JSON.stringify(portalTsconfig, null, 2) + '\n',
  );

  fs.writeFileSync(
    path.join(appDir, 'vite.config.ts'),
    `import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: { port: ${portal.port} },
});
`,
  );

  const vercelPath = path.join(appDir, 'vercel.json');
  if (fs.existsSync(vercelPath) || ['admin', 'management', 'super-admin', 'waiter', 'customer'].includes(portal.name)) {
    fs.writeFileSync(
      vercelPath,
      JSON.stringify(
        {
          $schema: 'https://openapi.vercel.sh/vercel.json',
          buildCommand: `cd ../.. && npx turbo run build --filter=@cullinos/${portal.name}`,
          outputDirectory: 'dist',
          installCommand: 'cd ../.. && npm ci',
          framework: 'vite',
          rewrites: [{ source: '/(.*)', destination: '/index.html' }],
        },
        null,
        2,
      ) + '\n',
    );
  }
}

console.log('Fixed', portals.length, 'portal apps');
