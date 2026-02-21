import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc, count } from "drizzle-orm";
import {
  supportTickets,
  supportMessages,
  users,
} from "@openframe/database/schema";

export const supportRoutes: FastifyPluginAsync = async (fastify) => {
  // All support routes require authentication
  fastify.addHook("onRequest", fastify.authenticateAny);

  // ============ POST /support — Create ticket ============
  fastify.post("/", async (request) => {
    const userId = (request.user as any).userId;
    const { subject, category, message } = request.body as {
      subject: string;
      category?: string;
      message: string;
    };

    // Create ticket + first message in a transaction
    const result = await fastify.db.transaction(async (tx) => {
      const tickets = await tx
        .insert(supportTickets)
        .values({
          userId,
          subject,
          category: (category as any) || "general",
        })
        .returning();
      const ticket = tickets[0]!;

      await tx
        .insert(supportMessages)
        .values({
          ticketId: ticket.id,
          senderId: userId,
          content: message,
          isAdminReply: false,
        });

      return ticket;
    });

    return { success: true, data: result };
  });

  // ============ GET /support — List my tickets ============
  fastify.get("/", async (request) => {
    const userId = (request.user as any).userId;
    const { status } = request.query as { status?: string };

    const conditions = [eq(supportTickets.userId, userId)];
    if (status) {
      conditions.push(eq(supportTickets.status, status as any));
    }

    const tickets = await fastify.db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        status: supportTickets.status,
        priority: supportTickets.priority,
        category: supportTickets.category,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
      })
      .from(supportTickets)
      .where(and(...conditions))
      .orderBy(desc(supportTickets.updatedAt));

    return { success: true, data: tickets };
  });

  // ============ GET /support/:id — Get my ticket with messages ============
  fastify.get("/:id", async (request) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as { id: string };

    const [ticket] = await fastify.db
      .select()
      .from(supportTickets)
      .where(and(eq(supportTickets.id, id), eq(supportTickets.userId, userId)))
      .limit(1);

    if (!ticket) {
      throw fastify.httpErrors.notFound("Ticket not found");
    }

    const messages = await fastify.db
      .select({
        id: supportMessages.id,
        content: supportMessages.content,
        isAdminReply: supportMessages.isAdminReply,
        createdAt: supportMessages.createdAt,
        senderId: supportMessages.senderId,
        senderName: users.name,
      })
      .from(supportMessages)
      .leftJoin(users, eq(supportMessages.senderId, users.id))
      .where(eq(supportMessages.ticketId, id))
      .orderBy(supportMessages.createdAt);

    return {
      success: true,
      data: {
        ...ticket,
        messages: messages.map((m) => ({
          id: m.id,
          content: m.content,
          isAdminReply: m.isAdminReply,
          createdAt: m.createdAt,
          sender: {
            id: m.senderId,
            name: m.senderName,
          },
        })),
      },
    };
  });

  // ============ POST /support/:id/messages — User reply ============
  fastify.post("/:id/messages", async (request) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as { id: string };
    const { content } = request.body as { content: string };

    // Verify ticket belongs to user
    const [ticket] = await fastify.db
      .select({ id: supportTickets.id })
      .from(supportTickets)
      .where(and(eq(supportTickets.id, id), eq(supportTickets.userId, userId)))
      .limit(1);

    if (!ticket) {
      throw fastify.httpErrors.notFound("Ticket not found");
    }

    const [message] = await fastify.db
      .insert(supportMessages)
      .values({
        ticketId: id,
        senderId: userId,
        content,
        isAdminReply: false,
      })
      .returning();

    // Check current status and reopen if waiting on user
    const [currentTicket] = await fastify.db
      .select({ status: supportTickets.status })
      .from(supportTickets)
      .where(eq(supportTickets.id, id))
      .limit(1);

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (currentTicket?.status === "waiting_on_user") {
      updates.status = "open";
    }

    await fastify.db
      .update(supportTickets)
      .set(updates)
      .where(eq(supportTickets.id, id));

    return { success: true, data: message };
  });
};
