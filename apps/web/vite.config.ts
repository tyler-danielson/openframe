import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

const basePath = process.env.VITE_BASE_PATH || "/";

// One 72-byte frame of MPEG-2.5 Layer III silence (8 kbps, 8 kHz, mono),
// generated with lamejs. Encoded silence is bit-identical frame to frame, so
// repeating this frame yields a valid silent MP3 (~72 ms per frame).
const SILENT_FRAME_B64 =
  "/+MYxAAAAANIAAAAAExBTUUDAAkIAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const SILENT_FRAME_COUNT = 141; // ≈ 10 s of audio

// Serves/emits the silent keep-silk-open.mp3 used by useSilkKeepAlive,
// synthesized from the frame above so no binary asset lives in the repo.
function keepSilkOpenAsset(): Plugin {
  const media = () =>
    Buffer.concat(new Array<Buffer>(SILENT_FRAME_COUNT).fill(Buffer.from(SILENT_FRAME_B64, "base64")));
  return {
    name: "keep-silk-open-asset",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] === "/keep-silk-open.mp3") {
          res.setHeader("Content-Type", "audio/mpeg");
          res.setHeader("Cache-Control", "no-store");
          res.end(media());
        } else {
          next();
        }
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "keep-silk-open.mp3", source: media() });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    keepSilkOpenAsset(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "OpenFrame",
        short_name: "OpenFrame",
        description: "Self-hosted calendar dashboard",
        theme_color: "#1e293b",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "landscape",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // 8 MB
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Let Vite handle code splitting automatically via lazy imports
        // manualChunks for react-pdf was causing React hook dispatcher
        // to be split across chunks, triggering error #310
      },
    },
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5176,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:6001",
        changeOrigin: true,
        xfwd: true, // Forward X-Forwarded-* headers
      },
    },
  },
});
