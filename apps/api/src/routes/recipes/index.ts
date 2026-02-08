import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { recipes, recipeUploadTokens, type RecipeIngredient } from "@openframe/database/schema";
import { getCategorySettings } from "../settings/index.js";
import { parseRecipe, type RecipeProvider, type ParsedRecipe } from "../../services/recipe-parser.js";
import sharp from "sharp";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join, dirname, extname } from "path";
import { existsSync, createReadStream } from "fs";

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return mimeTypes[ext] ?? "application/octet-stream";
}

interface CreateRecipeBody {
  title: string;
  description?: string | null;
  servings?: number | null;
  prepTime?: number | null;
  cookTime?: number | null;
  ingredients?: RecipeIngredient[];
  instructions?: string[];
  tags?: string[];
  notes?: string | null;
}

interface UpdateRecipeBody {
  title?: string;
  description?: string | null;
  servings?: number | null;
  prepTime?: number | null;
  cookTime?: number | null;
  ingredients?: RecipeIngredient[];
  instructions?: string[];
  tags?: string[];
  notes?: string | null;
}

// Get data directory for storing recipe images
function getDataDir(): string {
  return process.env.DATA_DIR || join(process.cwd(), "data");
}

// Generate unique filename
function generateFilename(ext: string): string {
  const timestamp = Date.now();
  const random = randomBytes(8).toString("hex");
  return `${timestamp}-${random}.${ext}`;
}

// Save image to disk and generate thumbnail
async function saveRecipeImage(
  buffer: Buffer,
  userId: string
): Promise<{ originalPath: string; thumbnailPath: string }> {
  const dataDir = getDataDir();
  const userDir = join(dataDir, "recipes", userId);

  // Ensure directories exist
  const originalDir = join(userDir, "original");
  const thumbDir = join(userDir, "thumbnails");

  await mkdir(originalDir, { recursive: true });
  await mkdir(thumbDir, { recursive: true });

  const filename = generateFilename("jpg");
  const originalPath = join(originalDir, filename);
  const thumbnailPath = join(thumbDir, filename);

  // Save original (convert to JPEG for consistency)
  await sharp(buffer)
    .jpeg({ quality: 90 })
    .toFile(originalPath);

  // Generate thumbnail (400px width)
  await sharp(buffer)
    .resize(400, null, { withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(thumbnailPath);

  // Return relative paths
  return {
    originalPath: `recipes/${userId}/original/${filename}`,
    thumbnailPath: `recipes/${userId}/thumbnails/${filename}`,
  };
}

// Delete recipe images
async function deleteRecipeImages(sourceImagePath: string | null, thumbnailPath: string | null): Promise<void> {
  const dataDir = getDataDir();

  if (sourceImagePath) {
    const fullPath = join(dataDir, sourceImagePath);
    if (existsSync(fullPath)) {
      await unlink(fullPath).catch(() => {});
    }
  }

  if (thumbnailPath) {
    const fullPath = join(dataDir, thumbnailPath);
    if (existsSync(fullPath)) {
      await unlink(fullPath).catch(() => {});
    }
  }
}

export const recipeRoutes: FastifyPluginAsync = async (fastify) => {
  const { authenticate, authenticateAny } = fastify;

  // GET /api/v1/recipes - List all user's recipes
  fastify.get(
    "/",
    {
      preHandler: [authenticateAny],
      schema: {
        description: "List all recipes for the current user",
        tags: ["Recipes"],
        querystring: {
          type: "object",
          properties: {
            favorite: { type: "boolean" },
            tag: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.id) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const query = request.query as { favorite?: boolean; tag?: string };

      let conditions = [eq(recipes.userId, user.id)];

      if (query.favorite === true) {
        conditions.push(eq(recipes.isFavorite, true));
      }

      const userRecipes = await fastify.db
        .select()
        .from(recipes)
        .where(and(...conditions))
        .orderBy(desc(recipes.updatedAt));

      // Filter by tag if specified
      let result = userRecipes;
      if (query.tag) {
        const tagLower = query.tag.toLowerCase();
        result = userRecipes.filter(r =>
          r.tags?.some(t => t.toLowerCase() === tagLower)
        );
      }

      return { success: true, data: result };
    }
  );

  // GET /api/v1/recipes/:id - Get single recipe
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [authenticateAny],
      schema: {
        description: "Get a specific recipe",
        tags: ["Recipes"],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.id) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const { id } = request.params;

      const [recipe] = await fastify.db
        .select()
        .from(recipes)
        .where(and(eq(recipes.id, id), eq(recipes.userId, user.id)))
        .limit(1);

      if (!recipe) {
        throw fastify.httpErrors.notFound("Recipe not found");
      }

      return { success: true, data: recipe };
    }
  );

  // POST /api/v1/recipes - Create recipe manually
  fastify.post<{ Body: CreateRecipeBody }>(
    "/",
    {
      preHandler: [authenticate],
      schema: {
        description: "Create a new recipe manually",
        tags: ["Recipes"],
        body: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: ["string", "null"] },
            servings: { type: ["number", "null"] },
            prepTime: { type: ["number", "null"] },
            cookTime: { type: ["number", "null"] },
            ingredients: { type: "array" },
            instructions: { type: "array" },
            tags: { type: "array" },
            notes: { type: ["string", "null"] },
          },
          required: ["title"],
        },
      },
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.id) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const body = request.body;

      const [recipe] = await fastify.db
        .insert(recipes)
        .values({
          userId: user.id,
          title: body.title,
          description: body.description ?? null,
          servings: body.servings ?? null,
          prepTime: body.prepTime ?? null,
          cookTime: body.cookTime ?? null,
          ingredients: body.ingredients ?? [],
          instructions: body.instructions ?? [],
          tags: body.tags ?? [],
          notes: body.notes ?? null,
        })
        .returning();

      return { success: true, data: recipe };
    }
  );

  // PATCH /api/v1/recipes/:id - Update recipe
  fastify.patch<{ Params: { id: string }; Body: UpdateRecipeBody }>(
    "/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update a recipe",
        tags: ["Recipes"],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: ["string", "null"] },
            servings: { type: ["number", "null"] },
            prepTime: { type: ["number", "null"] },
            cookTime: { type: ["number", "null"] },
            ingredients: { type: "array" },
            instructions: { type: "array" },
            tags: { type: "array" },
            notes: { type: ["string", "null"] },
          },
        },
      },
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.id) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const { id } = request.params;
      const body = request.body;

      // Check ownership
      const [existing] = await fastify.db
        .select()
        .from(recipes)
        .where(and(eq(recipes.id, id), eq(recipes.userId, user.id)))
        .limit(1);

      if (!existing) {
        throw fastify.httpErrors.notFound("Recipe not found");
      }

      const [updated] = await fastify.db
        .update(recipes)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(recipes.id, id))
        .returning();

      return { success: true, data: updated };
    }
  );

  // DELETE /api/v1/recipes/:id - Delete recipe
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete a recipe",
        tags: ["Recipes"],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.id) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const { id } = request.params;

      // Get recipe to delete associated images
      const [recipe] = await fastify.db
        .select()
        .from(recipes)
        .where(and(eq(recipes.id, id), eq(recipes.userId, user.id)))
        .limit(1);

      if (!recipe) {
        throw fastify.httpErrors.notFound("Recipe not found");
      }

      // Delete images
      await deleteRecipeImages(recipe.sourceImagePath, recipe.thumbnailPath);

      // Delete recipe
      await fastify.db
        .delete(recipes)
        .where(eq(recipes.id, id));

      return { success: true, message: "Recipe deleted" };
    }
  );

  // POST /api/v1/recipes/:id/favorite - Toggle favorite
  fastify.post<{ Params: { id: string } }>(
    "/:id/favorite",
    {
      preHandler: [authenticate],
      schema: {
        description: "Toggle recipe favorite status",
        tags: ["Recipes"],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.id) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const { id } = request.params;

      const [recipe] = await fastify.db
        .select()
        .from(recipes)
        .where(and(eq(recipes.id, id), eq(recipes.userId, user.id)))
        .limit(1);

      if (!recipe) {
        throw fastify.httpErrors.notFound("Recipe not found");
      }

      const [updated] = await fastify.db
        .update(recipes)
        .set({
          isFavorite: !recipe.isFavorite,
          updatedAt: new Date(),
        })
        .where(eq(recipes.id, id))
        .returning();

      return { success: true, data: updated };
    }
  );

  // POST /api/v1/recipes/upload-token - Generate QR upload token
  fastify.post(
    "/upload-token",
    {
      preHandler: [authenticate],
      schema: {
        description: "Generate a temporary token for mobile recipe upload",
        tags: ["Recipes"],
      },
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.id) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      // Generate token (expires in 30 minutes)
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await fastify.db.insert(recipeUploadTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });

      return {
        success: true,
        data: { token, expiresAt: expiresAt.toISOString() },
      };
    }
  );

  // GET /api/v1/recipes/upload/:token - Get token info (public)
  fastify.get<{ Params: { token: string } }>(
    "/upload/:token",
    {
      schema: {
        description: "Get upload token info",
        tags: ["Recipes"],
        params: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
          required: ["token"],
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params;

      const [tokenRecord] = await fastify.db
        .select()
        .from(recipeUploadTokens)
        .where(eq(recipeUploadTokens.token, token))
        .limit(1);

      if (!tokenRecord) {
        return reply.status(404).send({
          success: false,
          error: "Token not found",
        });
      }

      if (new Date() > tokenRecord.expiresAt) {
        // Clean up expired token
        await fastify.db
          .delete(recipeUploadTokens)
          .where(eq(recipeUploadTokens.id, tokenRecord.id));

        return reply.status(410).send({
          success: false,
          error: "Token expired",
        });
      }

      return {
        success: true,
        data: { expiresAt: tokenRecord.expiresAt.toISOString() },
      };
    }
  );

  // POST /api/v1/recipes/upload/:token - Upload image and parse recipe (public)
  fastify.post<{ Params: { token: string } }>(
    "/upload/:token",
    {
      schema: {
        description: "Upload recipe image and parse with AI",
        tags: ["Recipes"],
        params: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
          required: ["token"],
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params;

      // Validate token
      const [tokenRecord] = await fastify.db
        .select()
        .from(recipeUploadTokens)
        .where(eq(recipeUploadTokens.token, token))
        .limit(1);

      if (!tokenRecord) {
        return reply.status(404).send({
          success: false,
          error: "Token not found",
        });
      }

      if (new Date() > tokenRecord.expiresAt) {
        await fastify.db
          .delete(recipeUploadTokens)
          .where(eq(recipeUploadTokens.id, tokenRecord.id));

        return reply.status(410).send({
          success: false,
          error: "Token expired",
        });
      }

      // Get the uploaded file
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: "No file uploaded",
        });
      }

      // Read file buffer
      const buffer = await data.toBuffer();

      // Save the image
      const { originalPath, thumbnailPath } = await saveRecipeImage(
        buffer,
        tokenRecord.userId
      );

      // Convert to base64 data URL for AI parsing
      const mimeType = data.mimetype || "image/jpeg";
      const base64 = buffer.toString("base64");
      const imageDataUrl = `data:${mimeType};base64,${base64}`;

      // Get AI provider settings
      const recipeSettings = await getCategorySettings(fastify.db, "recipes");
      const provider = (recipeSettings.ai_provider as RecipeProvider) || "gemini";

      // Get API keys
      const openaiSettings = await getCategorySettings(fastify.db, "openai");
      const anthropicSettings = await getCategorySettings(fastify.db, "anthropic");
      const googleSettings = await getCategorySettings(fastify.db, "google");

      let parsedRecipe: ParsedRecipe;
      try {
        parsedRecipe = await parseRecipe(imageDataUrl, provider, {
          openai: openaiSettings.api_key,
          anthropic: anthropicSettings.api_key,
          gemini: googleSettings.gemini_api_key,
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Recipe parsing error");
        // Still save the recipe with just the image
        parsedRecipe = {
          title: "Untitled Recipe",
          description: null,
          servings: null,
          prepTime: null,
          cookTime: null,
          ingredients: [],
          instructions: [],
          tags: [],
        };
      }

      // Create the recipe
      const [recipe] = await fastify.db
        .insert(recipes)
        .values({
          userId: tokenRecord.userId,
          title: parsedRecipe.title,
          description: parsedRecipe.description,
          servings: parsedRecipe.servings,
          prepTime: parsedRecipe.prepTime,
          cookTime: parsedRecipe.cookTime,
          ingredients: parsedRecipe.ingredients,
          instructions: parsedRecipe.instructions,
          tags: parsedRecipe.tags,
          sourceImagePath: originalPath,
          thumbnailPath: thumbnailPath,
        })
        .returning();

      // Delete the token after successful upload
      await fastify.db
        .delete(recipeUploadTokens)
        .where(eq(recipeUploadTokens.id, tokenRecord.id));

      return { success: true, data: recipe };
    }
  );

  // GET /api/v1/recipes/image/:path(*) - Serve recipe images
  fastify.get<{ Params: { "*": string } }>(
    "/image/*",
    {
      preHandler: [authenticateAny],
      schema: {
        description: "Get recipe image",
        tags: ["Recipes"],
      },
    },
    async (request, reply) => {
      const imagePath = request.params["*"];
      const dataDir = getDataDir();
      const fullPath = join(dataDir, imagePath);

      // Security check - ensure path is within data directory
      if (!fullPath.startsWith(dataDir)) {
        throw fastify.httpErrors.forbidden("Invalid path");
      }

      if (!existsSync(fullPath)) {
        throw fastify.httpErrors.notFound("Image not found");
      }

      const stream = createReadStream(fullPath);
      const mimeType = getMimeType(fullPath);

      return reply
        .header("Content-Type", mimeType)
        .header("Cache-Control", "public, max-age=31536000")
        .send(stream);
    }
  );

  // GET /api/v1/recipes/tags - Get all unique tags
  fastify.get(
    "/tags",
    {
      preHandler: [authenticateAny],
      schema: {
        description: "Get all unique recipe tags",
        tags: ["Recipes"],
      },
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.id) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const userRecipes = await fastify.db
        .select({ tags: recipes.tags })
        .from(recipes)
        .where(eq(recipes.userId, user.id));

      // Collect all unique tags
      const tagSet = new Set<string>();
      for (const recipe of userRecipes) {
        if (recipe.tags) {
          for (const tag of recipe.tags) {
            tagSet.add(tag.toLowerCase());
          }
        }
      }

      return { success: true, data: Array.from(tagSet).sort() };
    }
  );
};
