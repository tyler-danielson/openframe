import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// One 72-byte frame of MPEG-2.5 Layer III silence (8 kbps, 8 kHz, mono),
// generated with lamejs. Encoded silence is bit-identical frame to frame, so
// repeating this frame yields a valid silent MP3 (~72 ms per frame).
const SILENT_FRAME_B64 =
  "/+MYxAAAAANIAAAAAExBTUUDAAkIAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const SILENT_FRAME_COUNT = 141; // ≈ 10 s of audio

// Serves/emits the silent keep-silk-open.mp3 used by KeepAlive,
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
  plugins: [react(), keepSilkOpenAsset()],
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
