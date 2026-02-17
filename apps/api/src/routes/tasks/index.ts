import type { FastifyPluginAsync } from "fastify";
import { eq, and, gte, lte } from "drizzle-orm";
import { taskLists, tasks, oauthTokens } from "@openframe/database/schema";
import { taskQuerySchema, createTaskSchema, updateTaskSchema } from "@openframe/shared/validators";
import { getCurrentUser } from "../../plugins/auth.js";
import { GoogleTasksService } from "../../services/google-tasks.js";
import { hasRequiredScopes, getScopesForFeature } from "../../utils/oauth-scopes.js";

export const taskRoutes: FastifyPluginAsync = async (fastify) => {
  // Sync tasks from Google
  fastify.post(
    "/sync",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Sync tasks from Google Tasks",
        tags: ["Tasks"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      // Get Google OAuth token
      const [token] = await fastify.db
        .select()
        .from(oauthTokens)
        .where(
          and(
            eq(oauthTokens.userId, user.id),
            eq(oauthTokens.provider, "google")
          )
        )
        .limit(1);

      if (!token?.accessToken) {
        return { success: false, error: "Google account not connected" };
      }

      // Check that the user has granted task scopes
      const requiredScopes = getScopesForFeature("google", "tasks");
      if (!hasRequiredScopes(token.scope, requiredScopes)) {
        return reply.code(403).send({
          success: false,
          error: "insufficient_scope",
          provider: "google",
          requiredFeature: "tasks",
          message: "Task access not yet authorized. Please grant task permissions.",
        });
      }

      const googleTasks = new GoogleTasksService(token.accessToken);

      // Fetch all task lists from Google
      const googleLists = await googleTasks.getTaskLists();

      let syncedLists = 0;
      let syncedTasks = 0;

      for (const googleList of googleLists) {
        // Upsert task list
        const [existingList] = await fastify.db
          .select()
          .from(taskLists)
          .where(
            and(
              eq(taskLists.userId, user.id),
              eq(taskLists.externalId, googleList.id)
            )
          )
          .limit(1);

        let listId: string;

        if (existingList) {
          await fastify.db
            .update(taskLists)
            .set({
              name: googleList.title,
              lastSyncAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(taskLists.id, existingList.id));
          listId = existingList.id;
        } else {
          const [newList] = await fastify.db
            .insert(taskLists)
            .values({
              userId: user.id,
              externalId: googleList.id,
              name: googleList.title,
              provider: "google",
              isVisible: true,
              lastSyncAt: new Date(),
            })
            .returning();
          listId = newList!.id;
          syncedLists++;
        }

        // Fetch tasks for this list
        const googleTaskItems = await googleTasks.getTasks(googleList.id);

        for (const googleTask of googleTaskItems) {
          const [existingTask] = await fastify.db
            .select()
            .from(tasks)
            .where(
              and(
                eq(tasks.taskListId, listId),
                eq(tasks.externalId, googleTask.id)
              )
            )
            .limit(1);

          const taskData = {
            title: googleTask.title,
            notes: googleTask.notes || null,
            status: googleTask.status,
            dueDate: googleTask.due ? new Date(googleTask.due) : null,
            completedAt: googleTask.completed ? new Date(googleTask.completed) : null,
            updatedAt: new Date(),
          };

          if (existingTask) {
            await fastify.db
              .update(tasks)
              .set(taskData)
              .where(eq(tasks.id, existingTask.id));
          } else {
            await fastify.db.insert(tasks).values({
              taskListId: listId,
              externalId: googleTask.id,
              ...taskData,
            });
            syncedTasks++;
          }
        }
      }

      return {
        success: true,
        data: {
          syncedLists,
          syncedTasks,
          totalLists: googleLists.length,
        },
      };
    }
  );

  // List task lists
  fastify.get(
    "/lists",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get all task lists",
        tags: ["Tasks"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const lists = await fastify.db
        .select()
        .from(taskLists)
        .where(eq(taskLists.userId, user.id));

      return {
        success: true,
        data: lists.map((list) => ({
          id: list.id,
          name: list.name,
          isVisible: list.isVisible,
          lastSyncAt: list.lastSyncAt,
        })),
      };
    }
  );

  // Get tasks
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get tasks with optional filters",
        tags: ["Tasks"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        querystring: {
          type: "object",
          properties: {
            listId: { type: "string", format: "uuid" },
            status: { type: "string", enum: ["needsAction", "completed"] },
            dueAfter: { type: "string", format: "date-time" },
            dueBefore: { type: "string", format: "date-time" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const query = taskQuerySchema.parse(request.query);

      // Get user's task lists
      const userLists = await fastify.db
        .select()
        .from(taskLists)
        .where(
          and(
            eq(taskLists.userId, user.id),
            eq(taskLists.isVisible, true)
          )
        );

      const listIds = query.listId
        ? [query.listId].filter((id) => userLists.some((l) => l.id === id))
        : userLists.map((l) => l.id);

      if (listIds.length === 0) {
        return { success: true, data: [] };
      }

      // Build query conditions
      const conditions = [
        eq(tasks.taskListId, listIds[0]!), // Will expand for multiple lists
      ];

      if (query.status) {
        conditions.push(eq(tasks.status, query.status));
      }

      if (query.dueAfter) {
        conditions.push(gte(tasks.dueDate, query.dueAfter));
      }

      if (query.dueBefore) {
        conditions.push(lte(tasks.dueDate, query.dueBefore));
      }

      // Get tasks from all lists
      const allTasks = [];
      for (const listId of listIds) {
        const listTasks = await fastify.db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.taskListId, listId),
              query.status ? eq(tasks.status, query.status) : undefined
            )
          );
        allTasks.push(...listTasks);
      }

      // Filter by due date if specified
      const filteredTasks = allTasks.filter((task) => {
        if (query.dueAfter && task.dueDate && task.dueDate < query.dueAfter) {
          return false;
        }
        if (query.dueBefore && task.dueDate && task.dueDate > query.dueBefore) {
          return false;
        }
        return true;
      });

      // Add list info
      const listMap = new Map(userLists.map((l) => [l.id, l]));
      const tasksWithList = filteredTasks.map((task) => ({
        ...task,
        list: {
          id: task.taskListId,
          name: listMap.get(task.taskListId)?.name,
        },
      }));

      return {
        success: true,
        data: tasksWithList,
      };
    }
  );

  // Create task
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Create a new task",
        tags: ["Tasks"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            taskListId: { type: "string", format: "uuid" },
            title: { type: "string" },
            notes: { type: "string" },
            dueDate: { type: "string", format: "date-time" },
          },
          required: ["taskListId", "title"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const input = createTaskSchema.parse(request.body);

      // Verify user owns the task list
      const [list] = await fastify.db
        .select()
        .from(taskLists)
        .where(
          and(
            eq(taskLists.id, input.taskListId),
            eq(taskLists.userId, user.id)
          )
        )
        .limit(1);

      if (!list) {
        return reply.notFound("Task list not found");
      }

      const [task] = await fastify.db
        .insert(tasks)
        .values({
          taskListId: input.taskListId,
          externalId: `local_${crypto.randomUUID()}`,
          title: input.title,
          notes: input.notes,
          dueDate: input.dueDate,
        })
        .returning();

      return reply.status(201).send({
        success: true,
        data: task,
      });
    }
  );

  // Update task
  fastify.patch(
    "/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Update a task",
        tags: ["Tasks"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };
      const input = updateTaskSchema.parse(request.body);

      // Get task and verify ownership
      const [existingTask] = await fastify.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);

      if (!existingTask) {
        return reply.notFound("Task not found");
      }

      const [list] = await fastify.db
        .select()
        .from(taskLists)
        .where(
          and(
            eq(taskLists.id, existingTask.taskListId),
            eq(taskLists.userId, user.id)
          )
        )
        .limit(1);

      if (!list) {
        return reply.notFound("Task not found");
      }

      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.title !== undefined) updates.title = input.title;
      if (input.notes !== undefined) updates.notes = input.notes;
      if (input.dueDate !== undefined) updates.dueDate = input.dueDate;
      if (input.status !== undefined) {
        updates.status = input.status;
        if (input.status === "completed") {
          updates.completedAt = new Date();
        } else {
          updates.completedAt = null;
        }
      }

      const [task] = await fastify.db
        .update(tasks)
        .set(updates)
        .where(eq(tasks.id, id))
        .returning();

      return {
        success: true,
        data: task,
      };
    }
  );

  // Complete task (convenience endpoint)
  fastify.post(
    "/:id/complete",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Mark task as completed",
        tags: ["Tasks"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      const [existingTask] = await fastify.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);

      if (!existingTask) {
        return reply.notFound("Task not found");
      }

      const [list] = await fastify.db
        .select()
        .from(taskLists)
        .where(
          and(
            eq(taskLists.id, existingTask.taskListId),
            eq(taskLists.userId, user.id)
          )
        )
        .limit(1);

      if (!list) {
        return reply.notFound("Task not found");
      }

      const [task] = await fastify.db
        .update(tasks)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, id))
        .returning();

      return {
        success: true,
        data: task,
      };
    }
  );

  // Delete task
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Delete a task",
        tags: ["Tasks"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      const [task] = await fastify.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);

      if (!task) {
        return reply.notFound("Task not found");
      }

      const [list] = await fastify.db
        .select()
        .from(taskLists)
        .where(
          and(eq(taskLists.id, task.taskListId), eq(taskLists.userId, user.id))
        )
        .limit(1);

      if (!list) {
        return reply.notFound("Task not found");
      }

      await fastify.db.delete(tasks).where(eq(tasks.id, id));

      return { success: true };
    }
  );
};
