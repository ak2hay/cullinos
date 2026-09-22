import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_DESKTOP === "true" ? "./" : "/",
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /packages\/shared/],
    },
  },
  server: { port: 5173 },
});
