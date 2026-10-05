import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireSuperAdmin, requireUser } from "../lib/access";
import { writeAudit } from "../lib/audit";
import { createAuthToken } from "../lib/auth";
import { HttpError } from "../lib/errors";
import { asyncHandler } from "../lib/http";
import { sendSetPassword } from "../lib/mailer";
import { prisma } from "../lib/prisma";
import { sessionFor, userCore } from "../lib/serialize";
import { putObject } from "../lib/storage";

export const usersRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const profileFields = {
  name: z.string().min(2).max(120),
  phone: z.string().max(40).optional().nullable(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  gender: z.string().max(40).optional().nullable(),
  address: z.string().max(240).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  occupation: z.string().max(120).optional().nullable(),
  goals: z.string().max(1000).optional().nullable(),
};

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = 25;
    const where = q
      ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] }
      : {};
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { memberships: { include: { club: { select: { id: true, name: true } } } } },
      }),
    ]);
    res.json({
      total,
      page,
      pageSize,
      users: users.map((user) => ({
        ...userCore(user),
        memberships: user.memberships.map((row) => ({
          clubId: row.clubId,
          clubName: row.club.name,
          status: row.status,
          joinedAt: row.joinedAt,
        })),
      })),
    });
  }),
);

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const body = z
      .object({
        email: z.string().email(),
        clubId: z.string().min(1),
        paymentAmount: z.number().int().positive(),
        paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        paymentReference: z.string().min(2).max(80),
        ...profileFields,
      })
      .parse(req.body);
    const club = await prisma.club.findUnique({ where: { id: body.clubId } });
    if (!club) throw new HttpError(404, "Club not found");
    const email = body.email.toLowerCase();
    const created = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });
      let isNew = false;
      const data = {
        name: body.name,
        phone: body.phone || null,
        gender: body.gender || null,
        address: body.address || null,
        city: body.city || null,
        occupation: body.occupation || null,
        goals: body.goals || null,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      };
      if (!user) {
        user = await tx.user.create({ data: { email, ...data, role: "USER", status: "INVITED" } });
        isNew = true;
      } else {
        user = await tx.user.update({ where: { id: user.id }, data });
      }
      await tx.membership.upsert({
        where: { userId_clubId: { userId: user.id, clubId: club.id } },
        create: { userId: user.id, clubId: club.id, status: "ACTIVE", joinedAt: new Date(body.paymentDate) },
        update: { status: "ACTIVE", endedAt: null },
      });
      const invoice = await tx.duesInvoice.create({
        data: {
          userId: user.id,
          clubId: club.id,
          amount: body.paymentAmount,
          currency: club.currency,
          status: "PAID",
          method: "MANUAL",
          manualReference: body.paymentReference,
          paidAt: new Date(body.paymentDate),
        },
      });
      return { user, invoice, isNew };
    });
    if (created.isNew || !created.user.passwordHash) {
      const token = await createAuthToken(created.user.id, "INVITE", 7);
      const url = `${process.env.WEB_ORIGIN || "http://localhost:3000"}/accept-invite?token=${token}`;
      await sendSetPassword(created.user.email, created.user.name, url);
    }
    await writeAudit({
      actorId: actor.id,
      action: "member.manual_create",
      entityType: "User",
      entityId: created.user.id,
      snapshot: { email, clubId: club.id, paymentReference: body.paymentReference, amount: body.paymentAmount },
    });
    res.status(201).json({ user: userCore(created.user), invoiceId: created.invoice.id });
  }),
);

usersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const body = z
      .object({
        ...profileFields,
        name: profileFields.name.optional(),
        status: z.enum(["INVITED", "ACTIVE", "SUSPENDED"]).optional(),
      })
      .parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...("name" in body && body.name ? { name: body.name } : {}),
        phone: body.phone,
        gender: body.gender,
        address: body.address,
        city: body.city,
        occupation: body.occupation,
        goals: body.goals,
        status: body.status,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : body.dateOfBirth === null ? null : undefined,
      },
    });
    await writeAudit({ actorId: actor.id, action: "user.update", entityType: "User", entityId: user.id });
    res.json({ user: userCore(user) });
  }),
);

usersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    if (actor.id === req.params.id) throw new HttpError(400, "You cannot delete your own account");
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { memberships: true, officerRoles: true, adminAppointments: true },
    });
    if (!user) throw new HttpError(404, "User not found");
    if (user.role === "SUPER_ADMIN") throw new HttpError(400, "Super Admin accounts cannot be deleted here");
    const { passwordHash: _password, ...snapshot } = user;
    await writeAudit({
      actorId: actor.id,
      action: "user.delete",
      entityType: "User",
      entityId: user.id,
      snapshot,
    });
    await prisma.user.delete({ where: { id: user.id } });
    res.json({ ok: true });
  }),
);

export const profileRouter = Router();

profileRouter.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    res.json({ user: await sessionFor(user.id) });
  }),
);

profileRouter.patch(
  "/profile",
  asyncHandler(async (req, res) => {
    const actor = requireUser(req);
    const body = z.object({ ...profileFields, name: profileFields.name.optional() }).parse(req.body);
    await prisma.user.update({
      where: { id: actor.id },
      data: {
        name: body.name,
        phone: body.phone,
        gender: body.gender,
        address: body.address,
        city: body.city,
        occupation: body.occupation,
        goals: body.goals,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : body.dateOfBirth === null ? null : undefined,
      },
    });
    res.json({ user: await sessionFor(actor.id) });
  }),
);

profileRouter.post(
  "/avatar",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const actor = requireUser(req);
    if (!req.file) throw new HttpError(400, "Choose an image");
    if (!req.file.mimetype.startsWith("image/")) throw new HttpError(400, "Avatar must be an image");
    const ext = req.file.mimetype === "image/png" ? "png" : req.file.mimetype === "image/webp" ? "webp" : "jpg";
    const key = `avatars/${actor.id}.${ext}`;
    await putObject(key, req.file.buffer, req.file.mimetype);
    await prisma.user.update({ where: { id: actor.id }, data: { avatarKey: key } });
    res.json({ user: await sessionFor(actor.id) });
  }),
);

profileRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: { club: { select: { id: true, name: true, slug: true, city: true } } },
      orderBy: { joinedAt: "desc" },
    });
    res.json({
      memberships: memberships.map((row) => ({
        id: row.id,
        status: row.status,
        joinedAt: row.joinedAt,
        endedAt: row.endedAt,
        club: row.club,
      })),
    });
  }),
);

profileRouter.get(
  "/dues",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const invoices = await prisma.duesInvoice.findMany({
      where: { userId: user.id },
      include: { club: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ invoices });
  }),
);

profileRouter.get(
  "/meetings",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      select: { clubId: true },
    });
    const clubIds = memberships.map((row) => row.clubId);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [upcoming, attended] = await Promise.all([
      prisma.meeting.findMany({
        where: { clubId: { in: clubIds }, status: "FINALIZED", meetingDate: { gte: today } },
        include: { club: { select: { id: true, name: true } }, rsvps: { where: { userId: user.id } }, agenda: { where: { assigneeId: user.id } } },
        orderBy: { meetingDate: "asc" },
      }),
      prisma.meeting.findMany({
        where: {
          clubId: { in: clubIds },
          status: "COMPLETED",
          OR: [{ attendance: { some: { userId: user.id, present: true } } }, { agenda: { some: { assigneeId: user.id } } }],
        },
        include: { club: { select: { id: true, name: true } }, agenda: { where: { assigneeId: user.id } } },
        orderBy: { meetingDate: "desc" },
      }),
    ]);
    res.json({ upcoming, attended });
  }),
);
