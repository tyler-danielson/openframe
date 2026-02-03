import Tesseract from "tesseract.js";
import { api } from "./api";

let worker: Tesseract.Worker | null = null;
let workerInitPromise: Promise<Tesseract.Worker> | null = null;

/**
 * Initialize the Tesseract worker lazily on first use.
 * Pre-loads English language data for faster subsequent recognitions.
 */
async function getWorker(): Promise<Tesseract.Worker> {
  if (worker) {
    return worker;
  }

  if (workerInitPromise) {
    return workerInitPromise;
  }

  workerInitPromise = Tesseract.createWorker("eng", 1);

  worker = await workerInitPromise;
  return worker;
}

/**
 * Recognize text from an image using Tesseract.js.
 * The image should be provided as a data URL (base64 PNG).
 *
 * @param imageDataUrl - Base64 data URL of the image (e.g., from canvas.toDataURL())
 * @returns The recognized text, trimmed of whitespace
 */
export async function recognizeText(imageDataUrl: string): Promise<string> {
  const w = await getWorker();
  const {
    data: { text },
  } = await w.recognize(imageDataUrl);
  return text.trim();
}

/**
 * Terminate the Tesseract worker to free resources.
 * Call this when the app is unmounting or the feature is no longer needed.
 */
export async function terminateWorker(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
    workerInitPromise = null;
  }
}

/**
 * Pre-initialize the worker for faster first recognition.
 * Call this when the drawing mode is about to be activated.
 */
export function preloadWorker(): void {
  getWorker().catch((err) => {
    console.error("Failed to preload Tesseract worker:", err);
  });
}

/**
 * Recognize text using AI providers (server-side).
 * Falls back to local Tesseract if server returns USE_LOCAL_TESSERACT.
 *
 * @param imageDataUrl - Base64 data URL of the image
 * @returns Object with recognized text and provider used
 */
export async function recognizeWithAI(imageDataUrl: string): Promise<{
  text: string;
  provider: string;
  usedFallback: boolean;
}> {
  try {
    const result = await api.recognizeHandwriting(imageDataUrl);
    return {
      text: result.text,
      provider: result.provider,
      usedFallback: false,
    };
  } catch (error) {
    // Check if server told us to use local Tesseract
    const message = error instanceof Error ? error.message : "";
    if (message.includes("USE_LOCAL_TESSERACT")) {
      const text = await recognizeText(imageDataUrl);
      return {
        text,
        provider: "tesseract",
        usedFallback: false,
      };
    }

    // For other errors, fall back to local Tesseract
    console.warn("AI recognition failed, falling back to Tesseract:", error);
    const text = await recognizeText(imageDataUrl);
    return {
      text,
      provider: "tesseract",
      usedFallback: true,
    };
  }
}
