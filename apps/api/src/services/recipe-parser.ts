import type { RecipeIngredient } from "@openframe/database/schema";

export interface ParsedRecipe {
  title: string;
  description: string | null;
  servings: number | null;
  prepTime: number | null;      // minutes
  cookTime: number | null;      // minutes
  ingredients: RecipeIngredient[];
  instructions: string[];
  tags: string[];
}

const RECIPE_PARSE_PROMPT = `Analyze this recipe image and extract the following information in JSON format.
Be thorough and accurate in extracting all details from the recipe.

Return a JSON object with this exact structure:
{
  "title": "Recipe name",
  "description": "Brief description of the dish (1-2 sentences, or null if not present)",
  "servings": number or null,
  "prepTime": number in minutes or null,
  "cookTime": number in minutes or null,
  "ingredients": [
    {"name": "ingredient name", "amount": "quantity as string", "unit": "measurement unit"}
  ],
  "instructions": ["Step 1...", "Step 2...", ...],
  "tags": ["category tags like dinner, easy, vegetarian, etc."]
}

Important:
- For ingredients, separate the amount and unit (e.g., "2 cups flour" becomes {"name": "flour", "amount": "2", "unit": "cups"})
- If amount is missing, use "" for amount and unit
- Instructions should be clear, complete steps
- Tags should be relevant categories (cuisine type, meal type, dietary info, difficulty, etc.)
- Return ONLY the JSON object, no additional text`;

// OpenAI GPT-4o Vision
export async function parseRecipeWithOpenAI(imageDataUrl: string, apiKey: string): Promise<ParsedRecipe> {
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
              text: RECIPE_PARSE_PROMPT,
            },
            {
              type: "image_url",
              image_url: { url: imageDataUrl },
            },
          ],
        },
      ],
      max_tokens: 2000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  return parseAndValidateRecipe(content);
}

// Anthropic Claude Vision
export async function parseRecipeWithClaude(imageDataUrl: string, apiKey: string): Promise<ParsedRecipe> {
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
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
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
              text: RECIPE_PARSE_PROMPT,
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
  if (!textContent?.text) {
    throw new Error("Claude returned empty response");
  }

  return parseAndValidateRecipe(textContent.text);
}

// Google Gemini Vision
export async function parseRecipeWithGemini(imageDataUrl: string, apiKey: string): Promise<ParsedRecipe> {
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
                text: RECIPE_PARSE_PROMPT,
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
        generationConfig: {
          responseMimeType: "application/json",
        },
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

  const content = data.candidates[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error("Gemini returned empty response");
  }

  return parseAndValidateRecipe(content);
}

// Parse and validate the JSON response
function parseAndValidateRecipe(content: string): ParsedRecipe {
  // Try to extract JSON from the content (in case there's extra text)
  let jsonStr = content.trim();

  // Try to find JSON object in the content
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("Failed to parse recipe JSON from AI response");
  }

  // Validate and sanitize the parsed data
  const recipe = parsed as Record<string, unknown>;

  const result: ParsedRecipe = {
    title: typeof recipe.title === "string" ? recipe.title : "Untitled Recipe",
    description: typeof recipe.description === "string" ? recipe.description : null,
    servings: typeof recipe.servings === "number" ? recipe.servings : null,
    prepTime: typeof recipe.prepTime === "number" ? recipe.prepTime : null,
    cookTime: typeof recipe.cookTime === "number" ? recipe.cookTime : null,
    ingredients: [],
    instructions: [],
    tags: [],
  };

  // Parse ingredients
  if (Array.isArray(recipe.ingredients)) {
    result.ingredients = recipe.ingredients.map((ing: unknown) => {
      if (typeof ing === "object" && ing !== null) {
        const i = ing as Record<string, unknown>;
        return {
          name: typeof i.name === "string" ? i.name : "",
          amount: typeof i.amount === "string" || typeof i.amount === "number" ? String(i.amount) : "",
          unit: typeof i.unit === "string" ? i.unit : "",
        };
      }
      // Handle string ingredients
      if (typeof ing === "string") {
        return { name: ing, amount: "", unit: "" };
      }
      return { name: "", amount: "", unit: "" };
    }).filter(i => i.name.length > 0);
  }

  // Parse instructions
  if (Array.isArray(recipe.instructions)) {
    result.instructions = recipe.instructions
      .filter((step): step is string => typeof step === "string" && step.trim().length > 0)
      .map(step => step.trim());
  }

  // Parse tags
  if (Array.isArray(recipe.tags)) {
    result.tags = recipe.tags
      .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
      .map(tag => tag.trim().toLowerCase());
  }

  return result;
}

export type RecipeProvider = "openai" | "claude" | "gemini";

export async function parseRecipe(
  imageDataUrl: string,
  provider: RecipeProvider,
  apiKeys: {
    openai?: string | null;
    anthropic?: string | null;
    gemini?: string | null;
  }
): Promise<ParsedRecipe> {
  switch (provider) {
    case "openai": {
      if (!apiKeys.openai) {
        throw new Error("OpenAI API key not configured. Add it in Settings → System → OpenAI.");
      }
      return parseRecipeWithOpenAI(imageDataUrl, apiKeys.openai);
    }

    case "claude": {
      if (!apiKeys.anthropic) {
        throw new Error("Anthropic API key not configured. Add it in Settings → System → Anthropic.");
      }
      return parseRecipeWithClaude(imageDataUrl, apiKeys.anthropic);
    }

    case "gemini": {
      if (!apiKeys.gemini) {
        throw new Error("Gemini API key not configured. Add it in Settings → System → Google APIs.");
      }
      return parseRecipeWithGemini(imageDataUrl, apiKeys.gemini);
    }

    default:
      throw new Error(`Unknown recipe parsing provider: ${provider}`);
  }
}
