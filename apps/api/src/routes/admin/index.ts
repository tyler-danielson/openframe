import type { FastifyPluginAsync } from "fastify";
import { eq, and, sql, desc, ilike, or, count } from "drizzle-orm";
import {
  users,
  userPlans,
  calendars,
  kiosks,
  cameras,
  supportTickets,
  supportMessages,
  type PlanLimits,
} from "@openframe/database/schema";

// Helper: extract count from drizzle result (always returns at least 0)
async function getCount(db: any, query: any): Promise<number> {
  const rows = await query;
  return Number(rows[0]?.total ?? 0);
}

// ============ Plan Templates (constant, not in DB) ============

interface PlanTemplate {
  id: string;
  name: string;
  limits: PlanLimits;
}

const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: "free",
    name: "Free",
    limits: {
      maxKiosks: 2,
      maxCalendars: 5,
      maxCameras: 2,
      features: {
        iptv: false,
        spotify: false,
        ai: false,
        homeAssistant: true,
        automations: false,
        companion: true,
      },
    },
  },
  {
    id: "starter",
    name: "Starter",
    limits: {
      maxKiosks: 5,
      maxCalendars: 15,
      maxCameras: 5,
      features: {
        iptv: true,
        spotify: true,
        ai: false,
        homeAssistant: true,
        automations: true,
        companion: true,
      },
    },
  },
  {
    id: "pro",
    name: "Pro",
    limits: {
      maxKiosks: 20,
      maxCalendars: 50,
      maxCameras: 20,
      features: {
        iptv: true,
        spotify: true,
        ai: true,
        homeAssistant: true,
        automations: true,
        companion: true,
      },
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    limits: {
      maxKiosks: 100,
      maxCalendars: 200,
      maxCameras: 100,
      features: {
        iptv: true,
        spotify: true,
        ai: true,
        homeAssistant: true,
        automations: true,
        companion: true,
      },
    },
  },
];

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // All admin routes require authentication + admin role
  fastify.addHook("onRequest", fastify.authenticateAny);
  fastify.addHook("onRequest", fastify.requireAdmin);

  // ============ GET /admin/stats ============
  fastify.get("/stats", async () => {
    const db = fastify.db;

    // Total users
    const totalUsers = await getCount(db,
      db.select({ total: count() }).from(users)
    );

    // Active users last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsersLast30d = await getCount(db,
      db.select({ total: count() }).from(users)
        .where(sql`${users.updatedAt} >= ${thirtyDaysAgo}`)
    );

    // New users last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newUsersLast7d = await getCount(db,
      db.select({ total: count() }).from(users)
        .where(sql`${users.createdAt} >= ${sevenDaysAgo}`)
    );

    // Plan distribution
    const planDist = await db
      .select({
        planId: userPlans.planId,
        planName: userPlans.planName,
        count: count(),
      })
      .from(userPlans)
      .groupBy(userPlans.planId, userPlans.planName);

    // Count users without any plan (free)
    const totalWithPlan = await getCount(db,
      db.select({ total: count() }).from(userPlans)
    );
    const freePlanCount = totalUsers - totalWithPlan;

    const planDistribution = [
      { planId: "free", planName: "Free", count: freePlanCount },
      ...planDist.map((p) => ({
        planId: p.planId,
        planName: p.planName,
        count: Number(p.count),
      })),
    ];

    // Ticket stats
    const ticketCounts = await db
      .select({
        status: supportTickets.status,
        count: count(),
      })
      .from(supportTickets)
      .groupBy(supportTickets.status);

    const ticketStats = {
      open: 0,
      inProgress: 0,
      resolved: 0,
    };
    for (const tc of ticketCounts) {
      if (tc.status === "open") ticketStats.open = Number(tc.count);
      if (tc.status === "in_progress")
        ticketStats.inProgress = Number(tc.count);
      if (tc.status === "resolved") ticketStats.resolved = Number(tc.count);
    }

    // Recent signups (last 30 days, grouped by day)
    const recentSignups = await db
      .select({
        date: sql<string>`date_trunc('day', ${users.createdAt})::date`,
        count: count(),
      })
      .from(users)
      .where(sql`${users.createdAt} >= ${thirtyDaysAgo}`)
      .groupBy(sql`date_trunc('day', ${users.createdAt})::date`)
      .orderBy(sql`date_trunc('day', ${users.createdAt})::date`);

    return {
      success: true,
      data: {
        totalUsers,
        activeUsersLast30d,
        newUsersLast7d,
        planDistribution,
        ticketStats,
        recentSignups: recentSignups.map((r) => ({
          date: r.date,
          count: Number(r.count),
        })),
      },
    };
  });

  // ============ GET /admin/plans ============
  fastify.get("/plans", async () => {
    return {
      success: true,
      data: PLAN_TEMPLATES.map((p) => ({
        id: p.id,
        name: p.name,
        limits: p.limits,
      })),
    };
  });

  // ============ GET /admin/users ============
  fastify.get("/users", async (request) => {
    const {
      page = "1",
      pageSize = "25",
      search,
      role,
      planId,
    } = request.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page || "1"));
    const size = Math.min(100, Math.max(1, parseInt(pageSize || "25")));
    const offset = (pageNum - 1) * size;

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(users.email, `%${search}%`),
          ilike(users.name, `%${search}%`)
        )
      );
    }
    if (role) {
      conditions.push(eq(users.role, role as any));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const total = await getCount(fastify.db,
      fastify.db.select({ total: count() }).from(users).where(whereClause)
    );

    const rows = await fastify.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        role: users.role,
        createdAt: users.createdAt,
        planId: userPlans.planId,
        planName: userPlans.planName,
      })
      .from(users)
      .leftJoin(userPlans, eq(users.id, userPlans.userId))
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(size)
      .offset(offset);

    // If planId filter requested, filter in app (since it's a LEFT JOIN)
    const filtered = planId
      ? rows.filter((r) => (r.planId || "free") === planId)
      : rows;

    return {
      success: true,
      data: {
        items: filtered.map((r) => ({
          id: r.id,
          email: r.email,
          name: r.name,
          avatarUrl: r.avatarUrl,
          role: r.role,
          planId: r.planId || "free",
          planName: r.planName || "Free",
          createdAt: r.createdAt,
        })),
        total,
        page: pageNum,
        pageSize: size,
        hasMore: offset + size < total,
      },
    };
  });

  // ============ GET /admin/users/:id ============
  fastify.get("/users/:id", async (request) => {
    const { id } = request.params as { id: string };

    const [user] = await fastify.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      throw fastify.httpErrors.notFound("User not found");
    }

    const [plan] = await fastify.db
      .select()
      .from(userPlans)
      .where(eq(userPlans.userId, id))
      .limit(1);

    const calendarCount = await getCount(fastify.db,
      fastify.db.select({ total: count() }).from(calendars).where(eq(calendars.userId, id))
    );

    const kioskCount = await getCount(fastify.db,
      fastify.db.select({ total: count() }).from(kiosks).where(eq(kiosks.userId, id))
    );

    const cameraCount = await getCount(fastify.db,
      fastify.db.select({ total: count() }).from(cameras).where(eq(cameras.userId, id))
    );

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt,
        plan: plan
          ? {
              planId: plan.planId,
              planName: plan.planName,
              limits: plan.limits,
              expiresAt: plan.expiresAt,
            }
          : { planId: "free", planName: "Free", limits: PLAN_TEMPLATES[0]!.limits, expiresAt: null },
        usage: {
          calendars: calendarCount,
          kiosks: kioskCount,
          cameras: cameraCount,
        },
      },
    };
  });

  // ============ PUT /admin/users/:id ============
  fastify.put("/users/:id", async (request) => {
    const { id } = request.params as { id: string };
    const { role } = request.body as { role: "admin" | "member" | "viewer" };

    const [updated] = await fastify.db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id, role: users.role });

    if (!updated) {
      throw fastify.httpErrors.notFound("User not found");
    }

    return { success: true, data: updated };
  });

  // ============ PUT /admin/users/:id/plan ============
  fastify.put("/users/:id/plan", async (request) => {
    const { id } = request.params as { id: string };
    const { planId, expiresAt } = request.body as {
      planId: string;
      expiresAt?: string | null;
    };

    const template = PLAN_TEMPLATES.find((p) => p.id === planId);
    if (!template) {
      throw fastify.httpErrors.badRequest(`Invalid plan: ${planId}`);
    }

    // Check user exists
    const [user] = await fastify.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user) {
      throw fastify.httpErrors.notFound("User not found");
    }

    // Upsert plan
    const [existing] = await fastify.db
      .select({ id: userPlans.id })
      .from(userPlans)
      .where(eq(userPlans.userId, id))
      .limit(1);

    if (existing) {
      await fastify.db
        .update(userPlans)
        .set({
          planId: template.id,
          planName: template.name,
          limits: template.limits,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          updatedAt: new Date(),
        })
        .where(eq(userPlans.userId, id));
    } else {
      await fastify.db.insert(userPlans).values({
        userId: id,
        planId: template.id,
        planName: template.name,
        limits: template.limits,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
    }

    return {
      success: true,
      data: {
        planId: template.id,
        planName: template.name,
        limits: template.limits,
      },
    };
  });

  // ============ GET /admin/support ============
  fastify.get("/support", async (request) => {
    const {
      page = "1",
      pageSize = "25",
      status,
      category,
      search,
    } = request.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page || "1"));
    const size = Math.min(100, Math.max(1, parseInt(pageSize || "25")));
    const offset = (pageNum - 1) * size;

    const conditions = [];
    if (status) {
      conditions.push(eq(supportTickets.status, status as any));
    }
    if (category) {
      conditions.push(eq(supportTickets.category, category as any));
    }
    if (search) {
      conditions.push(ilike(supportTickets.subject, `%${search}%`));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const total = await getCount(fastify.db,
      fastify.db.select({ total: count() }).from(supportTickets).where(whereClause)
    );

    const rows = await fastify.db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        status: supportTickets.status,
        priority: supportTickets.priority,
        category: supportTickets.category,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
        userId: supportTickets.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .where(whereClause)
      .orderBy(desc(supportTickets.updatedAt))
      .limit(size)
      .offset(offset);

    return {
      success: true,
      data: {
        items: rows.map((r) => ({
          id: r.id,
          subject: r.subject,
          status: r.status,
          priority: r.priority,
          category: r.category,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          user: {
            id: r.userId,
            name: r.userName,
            email: r.userEmail,
          },
        })),
        total,
        page: pageNum,
        pageSize: size,
        hasMore: offset + size < total,
      },
    };
  });

  // ============ GET /admin/support/:id ============
  fastify.get("/support/:id", async (request) => {
    const { id } = request.params as { id: string };

    const [ticket] = await fastify.db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        status: supportTickets.status,
        priority: supportTickets.priority,
        category: supportTickets.category,
        assignedAdminId: supportTickets.assignedAdminId,
        closedAt: supportTickets.closedAt,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
        userId: supportTickets.userId,
        userName: users.name,
        userEmail: users.email,
        userAvatarUrl: users.avatarUrl,
      })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .where(eq(supportTickets.id, id))
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
        senderEmail: users.email,
        senderAvatarUrl: users.avatarUrl,
      })
      .from(supportMessages)
      .leftJoin(users, eq(supportMessages.senderId, users.id))
      .where(eq(supportMessages.ticketId, id))
      .orderBy(supportMessages.createdAt);

    return {
      success: true,
      data: {
        ...ticket,
        user: {
          id: ticket.userId,
          name: ticket.userName,
          email: ticket.userEmail,
          avatarUrl: ticket.userAvatarUrl,
        },
        messages: messages.map((m) => ({
          id: m.id,
          content: m.content,
          isAdminReply: m.isAdminReply,
          createdAt: m.createdAt,
          sender: {
            id: m.senderId,
            name: m.senderName,
            email: m.senderEmail,
            avatarUrl: m.senderAvatarUrl,
          },
        })),
      },
    };
  });

  // ============ PUT /admin/support/:id ============
  fastify.put("/support/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      status?: string;
      priority?: string;
      category?: string;
      assignedAdminId?: string | null;
    };

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.status) updates.status = body.status;
    if (body.priority) updates.priority = body.priority;
    if (body.category) updates.category = body.category;
    if (body.assignedAdminId !== undefined)
      updates.assignedAdminId = body.assignedAdminId;
    if (body.status === "closed" || body.status === "resolved") {
      updates.closedAt = new Date();
    }

    const [updated] = await fastify.db
      .update(supportTickets)
      .set(updates)
      .where(eq(supportTickets.id, id))
      .returning();

    if (!updated) {
      throw fastify.httpErrors.notFound("Ticket not found");
    }

    return { success: true, data: updated };
  });

  // ============ POST /admin/support/:id/messages ============
  fastify.post("/support/:id/messages", async (request) => {
    const { id } = request.params as { id: string };
    const { content } = request.body as { content: string };
    const userId = (request.user as any).userId;

    // Verify ticket exists
    const [ticket] = await fastify.db
      .select({ id: supportTickets.id })
      .from(supportTickets)
      .where(eq(supportTickets.id, id))
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
        isAdminReply: true,
      })
      .returning();

    // Update ticket timestamp
    await fastify.db
      .update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, id));

    return { success: true, data: message };
  });
};
