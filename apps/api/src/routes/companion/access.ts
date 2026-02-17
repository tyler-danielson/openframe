import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { users, companionAccess } from "@openframe/database/schema";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "../../plugins/auth.js";

export const companionAccessRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /me — Get current user's companion context
  fastify.get(
    "/me",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Get current user's companion context",
        tags: ["Companion"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("Not authenticated");
      }

      // Check if user is admin (owner) — full access
      if (user.role === "admin") {
        return {
          success: true,
          data: {
            isOwner: true,
            permissions: null,
          },
        };
      }

      // Check for active companion_access record
      const [access] = await fastify.db
        .select()
        .from(companionAccess)
        .where(
          and(
            eq(companionAccess.userId, user.id),
            eq(companionAccess.isActive, true)
          )
        )
        .limit(1);

      if (!access) {
        return {
          success: true,
          data: {
            isOwner: false,
            permissions: null,
          },
        };
      }

      return {
        success: true,
        data: {
          isOwner: false,
          permissions: {
            accessCalendar: access.accessCalendar,
            accessTasks: access.accessTasks,
            accessKiosks: access.accessKiosks,
            accessPhotos: access.accessPhotos,
            accessIptv: access.accessIptv,
            accessHomeAssistant: access.accessHomeAssistant,
            accessNews: access.accessNews,
            accessWeather: access.accessWeather,
            accessRecipes: access.accessRecipes,
            allowedCalendarIds: access.allowedCalendarIds,
            allowedTaskListIds: access.allowedTaskListIds,
          },
        },
      };
    }
  );

  // GET /users — List companion users (owner only)
  fastify.get(
    "/users",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "List companion users for this owner",
        tags: ["Companion"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("Not authenticated");
      }

      const rows = await fastify.db
        .select({
          id: companionAccess.id,
          userId: companionAccess.userId,
          userName: users.name,
          userEmail: users.email,
          label: companionAccess.label,
          isActive: companionAccess.isActive,
          accessCalendar: companionAccess.accessCalendar,
          accessTasks: companionAccess.accessTasks,
          accessKiosks: companionAccess.accessKiosks,
          accessPhotos: companionAccess.accessPhotos,
          accessIptv: companionAccess.accessIptv,
          accessHomeAssistant: companionAccess.accessHomeAssistant,
          accessNews: companionAccess.accessNews,
          accessWeather: companionAccess.accessWeather,
          accessRecipes: companionAccess.accessRecipes,
          allowedCalendarIds: companionAccess.allowedCalendarIds,
          allowedTaskListIds: companionAccess.allowedTaskListIds,
          createdAt: companionAccess.createdAt,
        })
        .from(companionAccess)
        .leftJoin(users, eq(companionAccess.userId, users.id))
        .where(eq(companionAccess.ownerId, user.id));

      const result = rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        userName: row.userName,
        userEmail: row.userEmail,
        label: row.label,
        isActive: row.isActive,
        createdAt: row.createdAt,
        permissions: {
          accessCalendar: row.accessCalendar,
          accessTasks: row.accessTasks,
          accessKiosks: row.accessKiosks,
          accessPhotos: row.accessPhotos,
          accessIptv: row.accessIptv,
          accessHomeAssistant: row.accessHomeAssistant,
          accessNews: row.accessNews,
          accessWeather: row.accessWeather,
          accessRecipes: row.accessRecipes,
          allowedCalendarIds: row.allowedCalendarIds,
          allowedTaskListIds: row.allowedTaskListIds,
        },
      }));

      return { success: true, data: result };
    }
  );

  // POST /users — Create/invite companion user
  fastify.post(
    "/users",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Create or invite a companion user",
        tags: ["Companion"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["invite", "create"] },
            email: { type: "string", format: "email" },
            name: { type: "string" },
            password: { type: "string", minLength: 6 },
            label: { type: "string" },
            permissions: {
              type: "object",
              properties: {
                accessCalendar: { type: "string", enum: ["none", "view", "edit"] },
                accessTasks: { type: "string", enum: ["none", "view", "edit"] },
                accessKiosks: { type: "boolean" },
                accessPhotos: { type: "boolean" },
                accessIptv: { type: "boolean" },
                accessHomeAssistant: { type: "boolean" },
                accessNews: { type: "boolean" },
                accessWeather: { type: "boolean" },
                accessRecipes: { type: "boolean" },
                allowedCalendarIds: {
                  oneOf: [
                    { type: "array", items: { type: "string" } },
                    { type: "null" },
                  ],
                },
                allowedTaskListIds: {
                  oneOf: [
                    { type: "array", items: { type: "string" } },
                    { type: "null" },
                  ],
                },
              },
            },
          },
          required: ["type", "email"],
        },
      },
    },
    async (request, reply) => {
      const owner = await getCurrentUser(request);
      if (!owner) {
        return reply.unauthorized("Not authenticated");
      }

      const body = request.body as {
        type: "invite" | "create";
        email: string;
        name?: string;
        password?: string;
        label?: string;
        permissions?: Record<string, unknown>;
      };

      let targetUser;

      if (body.type === "invite") {
        // Look up existing user by email
        const [existing] = await fastify.db
          .select()
          .from(users)
          .where(eq(users.email, body.email))
          .limit(1);

        if (!existing) {
          return reply.notFound("No user found with that email");
        }

        targetUser = existing;
      } else {
        // Create a new lightweight user account
        if (!body.password) {
          return reply.badRequest("Password is required for new accounts");
        }

        // Check if email is already taken
        const [existing] = await fastify.db
          .select()
          .from(users)
          .where(eq(users.email, body.email))
          .limit(1);

        if (existing) {
          return reply.badRequest("A user with that email already exists");
        }

        const passwordHash = await bcrypt.hash(body.password, 12);

        const [newUser] = await fastify.db
          .insert(users)
          .values({
            email: body.email,
            name: body.name || null,
            passwordHash,
            role: "member",
          })
          .returning();

        targetUser = newUser!;
      }

      // Check if a companion_access row already exists
      const [existingAccess] = await fastify.db
        .select()
        .from(companionAccess)
        .where(
          and(
            eq(companionAccess.ownerId, owner.id),
            eq(companionAccess.userId, targetUser.id)
          )
        )
        .limit(1);

      if (existingAccess) {
        return reply.badRequest("This user already has companion access");
      }

      const perms = body.permissions || {};

      const [access] = await fastify.db
        .insert(companionAccess)
        .values({
          ownerId: owner.id,
          userId: targetUser.id,
          label: body.label || body.name || null,
          accessCalendar: (perms.accessCalendar as string) || "view",
          accessTasks: (perms.accessTasks as string) || "view",
          accessKiosks: (perms.accessKiosks as boolean) ?? false,
          accessPhotos: (perms.accessPhotos as boolean) ?? false,
          accessIptv: (perms.accessIptv as boolean) ?? false,
          accessHomeAssistant: (perms.accessHomeAssistant as boolean) ?? false,
          accessNews: (perms.accessNews as boolean) ?? true,
          accessWeather: (perms.accessWeather as boolean) ?? true,
          accessRecipes: (perms.accessRecipes as boolean) ?? true,
          allowedCalendarIds: (perms.allowedCalendarIds as string[] | null) ?? null,
          allowedTaskListIds: (perms.allowedTaskListIds as string[] | null) ?? null,
        })
        .returning();

      return reply.status(201).send({
        success: true,
        data: {
          id: access!.id,
          userId: targetUser.id,
          userName: targetUser.name,
          userEmail: targetUser.email,
          label: access!.label,
          isActive: access!.isActive,
          permissions: {
            accessCalendar: access!.accessCalendar,
            accessTasks: access!.accessTasks,
            accessKiosks: access!.accessKiosks,
            accessPhotos: access!.accessPhotos,
            accessIptv: access!.accessIptv,
            accessHomeAssistant: access!.accessHomeAssistant,
            accessNews: access!.accessNews,
            accessWeather: access!.accessWeather,
            accessRecipes: access!.accessRecipes,
            allowedCalendarIds: access!.allowedCalendarIds,
            allowedTaskListIds: access!.allowedTaskListIds,
          },
        },
      });
    }
  );

  // PATCH /users/:id — Update permissions
  fastify.patch(
    "/users/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Update companion user permissions",
        tags: ["Companion"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const owner = await getCurrentUser(request);
      if (!owner) {
        return reply.unauthorized("Not authenticated");
      }

      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (body.label !== undefined) updates.label = body.label;
      if (body.isActive !== undefined) updates.isActive = body.isActive;
      if (body.accessCalendar !== undefined) updates.accessCalendar = body.accessCalendar;
      if (body.accessTasks !== undefined) updates.accessTasks = body.accessTasks;
      if (body.accessKiosks !== undefined) updates.accessKiosks = body.accessKiosks;
      if (body.accessPhotos !== undefined) updates.accessPhotos = body.accessPhotos;
      if (body.accessIptv !== undefined) updates.accessIptv = body.accessIptv;
      if (body.accessHomeAssistant !== undefined) updates.accessHomeAssistant = body.accessHomeAssistant;
      if (body.accessNews !== undefined) updates.accessNews = body.accessNews;
      if (body.accessWeather !== undefined) updates.accessWeather = body.accessWeather;
      if (body.accessRecipes !== undefined) updates.accessRecipes = body.accessRecipes;
      if (body.allowedCalendarIds !== undefined) updates.allowedCalendarIds = body.allowedCalendarIds;
      if (body.allowedTaskListIds !== undefined) updates.allowedTaskListIds = body.allowedTaskListIds;

      const [updated] = await fastify.db
        .update(companionAccess)
        .set(updates)
        .where(
          and(
            eq(companionAccess.id, id),
            eq(companionAccess.ownerId, owner.id)
          )
        )
        .returning();

      if (!updated) {
        return reply.notFound("Companion access not found");
      }

      // Fetch the user info to return
      const [targetUser] = await fastify.db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, updated.userId))
        .limit(1);

      return {
        success: true,
        data: {
          id: updated.id,
          userId: updated.userId,
          userName: targetUser?.name ?? null,
          userEmail: targetUser?.email ?? "",
          label: updated.label,
          isActive: updated.isActive,
          permissions: {
            accessCalendar: updated.accessCalendar,
            accessTasks: updated.accessTasks,
            accessKiosks: updated.accessKiosks,
            accessPhotos: updated.accessPhotos,
            accessIptv: updated.accessIptv,
            accessHomeAssistant: updated.accessHomeAssistant,
            accessNews: updated.accessNews,
            accessWeather: updated.accessWeather,
            accessRecipes: updated.accessRecipes,
            allowedCalendarIds: updated.allowedCalendarIds,
            allowedTaskListIds: updated.allowedTaskListIds,
          },
        },
      };
    }
  );

  // DELETE /users/:id — Remove companion access
  fastify.delete(
    "/users/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Remove companion user access",
        tags: ["Companion"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const owner = await getCurrentUser(request);
      if (!owner) {
        return reply.unauthorized("Not authenticated");
      }

      const { id } = request.params as { id: string };

      const result = await fastify.db
        .delete(companionAccess)
        .where(
          and(
            eq(companionAccess.id, id),
            eq(companionAccess.ownerId, owner.id)
          )
        )
        .returning();

      if (result.length === 0) {
        return reply.notFound("Companion access not found");
      }

      return { success: true };
    }
  );
};
