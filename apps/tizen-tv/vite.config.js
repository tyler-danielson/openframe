import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

// Explicit __dirname for ESM + UNC path compatibility
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    assetsInlineLimit: 100000,
    outDir: "dist",
    target: "es2020",
  },
  server: {
    host: "0.0.0.0",
    port: 5180,
    strictPort: true,
  },
});
