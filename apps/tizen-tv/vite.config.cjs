const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const path = require("path");

module.exports = defineConfig({
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
