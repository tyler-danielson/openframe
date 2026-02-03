import type { FastifyPluginAsync } from "fastify";
import { getCategorySettings } from "../settings/index.js";

type HandwritingProvider = "tesseract" | "gemini" | "openai" | "claude" | "google_vision";

interface RecognizeBody {
  imageData: string; // base64 data URL
}

interface RecognizeResponse {
  success: boolean;
  data?: {
    text: string;
    provider: string;
  };
  error?: string;
}

// OpenAI GPT-4o Vision
async function recognizeWithOpenAI(imageDataUrl: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the handwritten text from this image. Return only the text, no explanations.",
            },
            {
              type: "image_url",
              image_url: { url: imageDataUrl },
            },
          ],
        },
      ],
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content?.trim() || "";
}

// Anthropic Claude Vision
async function recognizeWithClaude(imageDataUrl: string, apiKey: string): Promise<string> {
  // Extract base64 data from data URL
  const base64Match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!base64Match) {
    throw new Error("Invalid image data URL format");
  }
  const [, mediaType, base64Data] = base64Match;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: `image/${mediaType}`,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: "Extract the handwritten text from this image. Return only the text, no explanations.",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(errorData.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text?: string }>;
  };

  const textContent = data.content.find((c) => c.type === "text");
  return textContent?.text?.trim() || "";
}

// Google Gemini Vision
async function recognizeWithGemini(imageDataUrl: string, apiKey: string): Promise<string> {
  // Extract base64 data from data URL
  const base64Match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!base64Match) {
    throw new Error("Invalid image data URL format");
  }
  const [, mediaType, base64Data] = base64Match;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Extract the handwritten text from this image. Return only the text, no explanations.",
              },
              {
                inline_data: {
                  mime_type: `image/${mediaType}`,
                  data: base64Data,
                },
              },
            ],
          },
        ],
      }),
    }
  );

  const data = await response.json() as {
    candidates?: Array<{
      content: {
        parts: Array<{ text?: string }>;
      };
    }>;
    error?: { message?: string; code?: number };
  };

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Gemini API error: ${response.status}`);
  }

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("Gemini returned no candidates");
  }

  return data.candidates[0]?.content?.parts?.[0]?.text?.trim() || "";
}

// Google Cloud Vision
async function recognizeWithGoogleVision(imageDataUrl: string, apiKey: string): Promise<string> {
  // Extract base64 data from data URL
  const base64Match = imageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error("Invalid image data URL format");
  }
  const base64Data = base64Match[1];

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Data },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(errorData.error?.message || `Google Vision API error: ${response.status}`);
  }

  const data = await response.json() as {
    responses: Array<{
      fullTextAnnotation?: { text: string };
      error?: { message: string };
    }>;
  };

  if (data.responses[0]?.error) {
    throw new Error(data.responses[0].error.message);
  }

  return data.responses[0]?.fullTextAnnotation?.text?.trim() || "";
}

export const handwritingRoutes: FastifyPluginAsync = async (fastify) => {
  const { authenticate } = fastify;

  // POST /api/v1/handwriting/recognize
  fastify.post<{
    Body: RecognizeBody;
  }>(
    "/recognize",
    {
      preHandler: [authenticate],
      schema: {
        description: "Recognize handwritten text from an image using AI",
        tags: ["Handwriting"],
        body: {
          type: "object",
          properties: {
            imageData: { type: "string", description: "Base64 data URL of the image" },
          },
          required: ["imageData"],
        },
      },
    },
    async (request, reply): Promise<RecognizeResponse> => {
      const { imageData } = request.body;

      if (!imageData || !imageData.startsWith("data:image/")) {
        return reply.status(400).send({
          success: false,
          error: "Invalid image data. Expected a base64 data URL.",
        });
      }

      // Get handwriting settings
      const settings = await getCategorySettings(fastify.db, "handwriting");
      const provider = (settings.provider as HandwritingProvider) || "tesseract";

      // If provider is tesseract, tell client to use local recognition
      if (provider === "tesseract") {
        return reply.status(200).send({
          success: false,
          error: "USE_LOCAL_TESSERACT",
        });
      }

      try {
        let text: string;

        switch (provider) {
          case "openai": {
            const apiKey = settings.openai_api_key;
            if (!apiKey) {
              return reply.status(400).send({
                success: false,
                error: "OpenAI API key not configured",
              });
            }
            text = await recognizeWithOpenAI(imageData, apiKey);
            break;
          }

          case "claude": {
            const apiKey = settings.anthropic_api_key;
            if (!apiKey) {
              return reply.status(400).send({
                success: false,
                error: "Anthropic API key not configured",
              });
            }
            text = await recognizeWithClaude(imageData, apiKey);
            break;
          }

          case "gemini": {
            const apiKey = settings.gemini_api_key;
            if (!apiKey) {
              return reply.status(400).send({
                success: false,
                error: "Gemini API key not configured",
              });
            }
            text = await recognizeWithGemini(imageData, apiKey);
            break;
          }

          case "google_vision": {
            const apiKey = settings.google_vision_api_key;
            if (!apiKey) {
              return reply.status(400).send({
                success: false,
                error: "Google Vision API key not configured",
              });
            }
            text = await recognizeWithGoogleVision(imageData, apiKey);
            break;
          }

          default:
            return reply.status(400).send({
              success: false,
              error: `Unknown provider: ${provider}`,
            });
        }

        return {
          success: true,
          data: {
            text,
            provider,
          },
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Handwriting recognition error");
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : "Recognition failed",
        });
      }
    }
  );

  // GET /api/v1/handwriting/provider - Get current provider setting
  fastify.get(
    "/provider",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get the current handwriting recognition provider",
        tags: ["Handwriting"],
      },
    },
    async () => {
      const settings = await getCategorySettings(fastify.db, "handwriting");
      const provider = settings.provider || "tesseract";

      // Check which API keys are configured
      const hasOpenAI = !!settings.openai_api_key;
      const hasClaude = !!settings.anthropic_api_key;
      const hasGemini = !!settings.gemini_api_key;
      const hasGoogleVision = !!settings.google_vision_api_key;

      return {
        success: true,
        data: {
          provider,
          configured: {
            tesseract: true, // Always available
            openai: hasOpenAI,
            claude: hasClaude,
            gemini: hasGemini,
            google_vision: hasGoogleVision,
          },
        },
      };
    }
  );

  // POST /api/v1/handwriting/test - Test provider connection
  fastify.post<{
    Body: { provider: HandwritingProvider };
  }>(
    "/test",
    {
      preHandler: [authenticate],
      schema: {
        description: "Test handwriting recognition provider connection",
        tags: ["Handwriting"],
        body: {
          type: "object",
          properties: {
            provider: { type: "string", enum: ["tesseract", "gemini", "openai", "claude", "google_vision"] },
          },
          required: ["provider"],
        },
      },
    },
    async (request, reply) => {
      const { provider } = request.body;

      if (provider === "tesseract") {
        return {
          success: true,
          data: { message: "Tesseract is always available (runs locally)" },
        };
      }

      const settings = await getCategorySettings(fastify.db, "handwriting");

      // Create a simple test image (1x1 white pixel PNG)
      const testImageData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

      try {
        switch (provider) {
          case "openai": {
            const apiKey = settings.openai_api_key;
            if (!apiKey) {
              return reply.status(400).send({
                success: false,
                error: "OpenAI API key not configured",
              });
            }
            // Just verify the API key works by making a minimal request
            await recognizeWithOpenAI(testImageData, apiKey);
            break;
          }

          case "claude": {
            const apiKey = settings.anthropic_api_key;
            if (!apiKey) {
              return reply.status(400).send({
                success: false,
                error: "Anthropic API key not configured",
              });
            }
            await recognizeWithClaude(testImageData, apiKey);
            break;
          }

          case "gemini": {
            const apiKey = settings.gemini_api_key;
            if (!apiKey) {
              return reply.status(400).send({
                success: false,
                error: "Gemini API key not configured",
              });
            }
            await recognizeWithGemini(testImageData, apiKey);
            break;
          }

          case "google_vision": {
            const apiKey = settings.google_vision_api_key;
            if (!apiKey) {
              return reply.status(400).send({
                success: false,
                error: "Google Vision API key not configured",
              });
            }
            await recognizeWithGoogleVision(testImageData, apiKey);
            break;
          }

          default:
            return reply.status(400).send({
              success: false,
              error: `Unknown provider: ${provider}`,
            });
        }

        return {
          success: true,
          data: { message: `${provider} connection successful` },
        };
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : "Connection test failed",
        });
      }
    }
  );
};
