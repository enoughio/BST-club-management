import { Router } from "express";
import { z } from "zod";
import { assertClubAdmin, requireSuperAdmin, requireUser } from "../lib/access";
import { HttpError } from "../lib/errors";
import { asyncHandler } from "../lib/http";
import { sendAnnouncementMail } from "../lib/mailer";
import { notifyUsers } from "../lib/notify";
import { prisma } from "../lib/prisma";

export const commsRouter = Router();

commsRouter.get(
  "/announcements",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const memberships = await prisma.membership.findMany({ where: { userId: user.id, status: "ACTIVE" }, select: { clubId: true } });
    const clubIds = memberships.map((row) => row.clubId);
    const announcements = await prisma.announcement.findMany({
      where: {
        OR: [{ scope: "GLOBAL" }, { clubId: { in: clubIds } }],
      },
      include: { author: { select: { id: true, name: true } }, club: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ announcements });
  }),
);

commsRouter.post(
  "/announcements",
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const body = z.object({ title: z.string().min(2).max(160), body: z.string().min(2).max(5000) }).parse(req.body);
    const announcement = await prisma.announcement.create({
      data: { title: body.title, body: body.body, scope: "GLOBAL", authorId: actor.id },
    });
    const users = await prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true, email: true } });
    await notifyUsers(users.map((row) => row.id), body.title, body.body.slice(0, 180), "/hq/announcements");
    await Promise.all(users.map((row) => sendAnnouncementMail(row.email, body.title, body.body).catch((error) => console.error(error))));
    res.status(201).json({ announcement });
  }),
);

commsRouter.get(
  "/clubs/:id/announcements",
  asyncHandler(async (req, res) => {
    requireUser(req);
    const announcements = await prisma.announcement.findMany({
      where: { clubId: req.params.id },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ announcements });
  }),
);

commsRouter.post(
  "/clubs/:id/announcements",
  asyncHandler(async (req, res) => {
    const actor = requireUser(req);
    await assertClubAdmin(actor.id, req.params.id);
    const body = z.object({ title: z.string().min(2).max(160), body: z.string().min(2).max(5000) }).parse(req.body);
    const announcement = await prisma.announcement.create({
      data: { title: body.title, body: body.body, scope: "CLUB", clubId: req.params.id, authorId: actor.id },
    });
    const members = await prisma.membership.findMany({
      where: { clubId: req.params.id, status: "ACTIVE" },
      include: { user: { select: { id: true, email: true } } },
    });
    await notifyUsers(
      members.map((row) => row.user.id),
      body.title,
      body.body.slice(0, 180),
      `/club/${req.params.id}/announcements`,
    );
    await Promise.all(members.map((row) => sendAnnouncementMail(row.user.email, body.title, body.body).catch((error) => console.error(error))));
    res.status(201).json({ announcement });
  }),
);

commsRouter.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { userId: user.id } } },
      include: {
        club: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, include: { sender: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ conversations });
  }),
);

commsRouter.post(
  "/conversations",
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const body = z.object({ clubId: z.string(), subject: z.string().min(2).max(160), body: z.string().min(1).max(5000) }).parse(req.body);
    const admin = await prisma.clubAdmin.findFirst({
      where: { clubId: body.clubId, endedAt: null },
      include: { user: true, club: true },
    });
    if (!admin) throw new HttpError(400, "This club has no Club Admin");
    const conversation = await prisma.conversation.create({
      data: {
        clubId: body.clubId,
        subject: body.subject,
        participants: { create: [{ userId: actor.id }, { userId: admin.userId }] },
        messages: { create: { senderId: actor.id, body: body.body } },
      },
    });
    await notifyUsers([admin.userId], "Message from Headquarters", body.subject, `/club/${body.clubId}/messages`);
    res.status(201).json({ conversation });
  }),
);

commsRouter.get(
  "/conversations/:id",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, participants: { some: { userId: user.id } } },
      include: {
        club: { select: { id: true, name: true } },
        participants: { include: { user: { select: { id: true, name: true, email: true } } } },
        messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, name: true } } } },
      },
    });
    if (!conversation) throw new HttpError(404, "Conversation not found");
    res.json({ conversation });
  }),
);

commsRouter.post(
  "/conversations/:id/messages",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, participants: { some: { userId: user.id } } },
      include: { participants: true },
    });
    if (!conversation) throw new HttpError(404, "Conversation not found");
    const body = z.object({ body: z.string().min(1).max(5000) }).parse(req.body);
    const message = await prisma.message.create({
      data: { conversationId: conversation.id, senderId: user.id, body: body.body },
      include: { sender: { select: { id: true, name: true } } },
    });
    const others = conversation.participants.map((row) => row.userId).filter((id) => id !== user.id);
    await notifyUsers(others, "New message", body.body.slice(0, 140), "/hq/messages");
    res.status(201).json({ message });
  }),
);

commsRouter.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ notifications });
  }),
);

commsRouter.post(
  "/notifications/:id/read",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: user.id },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

commsRouter.post(
  "/notifications/read-all",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    res.json({ ok: true });
  }),
);

commsRouter.post(
  "/push/subscribe",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const body = z
      .object({
        endpoint: z.string().url(),
        keys: z.object({ p256dh: z.string(), auth: z.string() }),
      })
      .parse(req.body);
    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: { userId: user.id, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth },
      update: { userId: user.id, p256dh: body.keys.p256dh, auth: body.keys.auth },
    });
    res.json({ subscription: { id: subscription.id, endpoint: subscription.endpoint } });
  }),
);

export const settingsRouter = Router();

settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const settings = await prisma.orgSettings.findUnique({ where: { id: "org" } });
    res.json({
      settings: settings || {
        id: "org",
        name: "Club Portal",
        logoKey: null,
        primaryColor: "#1e3a5f",
        defaultFeeAmount: 150000,
        defaultCurrency: "INR",
        supportEmail: null,
      },
    });
  }),
);

settingsRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const body = z
      .object({
        name: z.string().min(2).max(120).optional(),
        primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        defaultFeeAmount: z.number().int().positive().optional(),
        defaultCurrency: z.string().length(3).optional(),
        supportEmail: z.string().email().optional().nullable(),
      })
      .parse(req.body);
    const settings = await prisma.orgSettings.upsert({
      where: { id: "org" },
      create: {
        id: "org",
        name: body.name || "Club Portal",
        primaryColor: body.primaryColor || "#1e3a5f",
        defaultFeeAmount: body.defaultFeeAmount || 150000,
        defaultCurrency: body.defaultCurrency || "INR",
        supportEmail: body.supportEmail || null,
      },
      update: {
        name: body.name,
        primaryColor: body.primaryColor,
        defaultFeeAmount: body.defaultFeeAmount,
        defaultCurrency: body.defaultCurrency?.toUpperCase(),
        supportEmail: body.supportEmail,
      },
    });
    const { writeAudit } = await import("../lib/audit");
    await writeAudit({ actorId: actor.id, action: "settings.update", entityType: "OrgSettings", entityId: "org" });
    res.json({ settings });
  }),
);
