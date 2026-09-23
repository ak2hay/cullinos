import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => {
  if (command === "build" && !process.env.VITE_API_URL?.trim()) {
    throw new Error("VITE_API_URL must be set for production builds");
  }
  return {
    build: { sourcemap: false },
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@cullinos/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
        "@cullinos/ui": path.resolve(__dirname, "../../packages/ui/src"),
      },
    },
    server: { port: 5181 },
  };
});
