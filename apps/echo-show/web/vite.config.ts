import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    // Echo Show's Silk browser is Chromium-based, ES2020 is safe
    target: "es2020",
  },
  server: {
    host: "0.0.0.0",
    port: 5181,
    strictPort: true,
  },
});
