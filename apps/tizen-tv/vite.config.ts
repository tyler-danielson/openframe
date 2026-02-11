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
    // Tizen requires inline assets for easier packaging
    assetsInlineLimit: 100000,
    outDir: "dist",
    // Ensure compatibility with older TV browsers
    target: "es2020",
  },
  server: {
    host: "0.0.0.0",
    port: 5180,
    strictPort: true,
  },
});
