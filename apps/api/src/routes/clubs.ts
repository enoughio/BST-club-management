import { Router } from "express";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import multer from "multer";
import { z } from "zod";
import { assertClubAdmin, assertHqOrClubAdmin, assertStaff, clubOr404, requireSuperAdmin, requireUser } from "../lib/access";
import { writeAudit } from "../lib/audit";
import { addMonths, slugify } from "../lib/dates";
import { HttpError } from "../lib/errors";
import { asyncHandler } from "../lib/http";
import { prisma } from "../lib/prisma";
import { TITLES } from "../lib/serialize";

export const clubsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

clubsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const q = String(req.query.q || "").trim();
    const search = q
      ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { city: { contains: q, mode: "insensitive" as const } }] }
      : {};
    if (user.role === "SUPER_ADMIN") {
      const clubs = await prisma.club.findMany({
        where: search,
        orderBy: { name: "asc" },
        include: { admins: { where: { endedAt: null }, include: { user: { select: { id: true, name: true, email: true } } } } },
      });
      res.json({
        clubs: clubs.map((club) => ({
          ...club,
          currentAdmin: club.admins[0]?.user || null,
          admins: undefined,
        })),
      });
      return;
    }
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id, ...({ club: search }) },
      include: { club: true },
    });
    res.json({ clubs: memberships.map((row) => row.club) });
  }),
);

clubsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const body = z
      .object({
        name: z.string().min(2).max(120),
        city: z.string().min(2).max(80),
        address: z.string().max(240).optional().nullable(),
        meetingSchedule: z.string().max(160).optional().nullable(),
        description: z.string().max(2000).optional().nullable(),
        charterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: z.enum(["ACTIVE", "INACTIVE", "PROVISIONAL"]).optional(),
        membershipFeeAmount: z.number().int().positive(),
        currency: z.string().length(3).optional(),
        electionIntervalMonths: z.number().int().min(1).max(60),
      })
      .parse(req.body);
    const charterDate = new Date(`${body.charterDate}T00:00:00.000Z`);
    let slug = slugify(body.name) || "club";
    const taken = await prisma.club.findUnique({ where: { slug } });
    if (taken) slug = `${slug}-${Date.now().toString().slice(-4)}`;
    const club = await prisma.club.create({
      data: {
        name: body.name,
        slug,
        city: body.city,
        address: body.address || null,
        meetingSchedule: body.meetingSchedule || null,
        description: body.description || null,
        charterDate,
        status: body.status || "ACTIVE",
        membershipFeeAmount: body.membershipFeeAmount,
        currency: (body.currency || "INR").toUpperCase(),
        electionIntervalMonths: body.electionIntervalMonths,
        nextElectionAt: addMonths(charterDate, body.electionIntervalMonths),
      },
    });
    await writeAudit({ actorId: actor.id, action: "club.create", entityType: "Club", entityId: club.id, snapshot: { name: club.name, slug: club.slug } });
    res.status(201).json({ club });
  }),
);

clubsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const club = await prisma.club.findUnique({
      where: { id: req.params.id },
      include: { admins: { where: { endedAt: null }, include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    if (!club) throw new HttpError(404, "Club not found");
    const isSuper = user.role === "SUPER_ADMIN";
    const isAdmin = Boolean(await prisma.clubAdmin.findFirst({ where: { clubId: club.id, userId: user.id, endedAt: null } }));
    const isStaff = isAdmin || Boolean(await prisma.officerRole.findFirst({ where: { clubId: club.id, userId: user.id, endedAt: null } }));
    let members: unknown[] = [];
    if (isSuper || isStaff) {
      const rows = await prisma.membership.findMany({
        where: { clubId: club.id },
        include: { user: { select: { id: true, name: true, email: true, phone: true, city: true, status: true } } },
        orderBy: { joinedAt: "asc" },
      });
      members = rows.map((row) => ({
        membershipId: row.id,
        status: row.status,
        joinedAt: row.joinedAt,
        endedAt: row.endedAt,
        user: row.user,
      }));
    }
    res.json({
      club: { ...club, admins: undefined, currentAdmin: club.admins[0]?.user || null },
      members,
    });
  }),
);

clubsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const club = await clubOr404(req.params.id);
    const actor = await assertHqOrClubAdmin(req, club.id);
    const body = z
      .object({
        name: z.string().min(2).max(120).optional(),
        city: z.string().min(2).max(80).optional(),
        address: z.string().max(240).optional().nullable(),
        meetingSchedule: z.string().max(160).optional().nullable(),
        description: z.string().max(2000).optional().nullable(),
        status: z.enum(["ACTIVE", "INACTIVE", "PROVISIONAL"]).optional(),
      })
      .parse(req.body);
    if (body.status && actor.role !== "SUPER_ADMIN") {
      throw new HttpError(403, "Only Headquarters can change club status");
    }
    const updated = await prisma.club.update({ where: { id: club.id }, data: body });
    await writeAudit({ actorId: actor.id, action: "club.update", entityType: "Club", entityId: club.id });
    res.json({ club: updated });
  }),
);

clubsRouter.patch(
  "/:id/billing",
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const club = await clubOr404(req.params.id);
    const body = z
      .object({
        membershipFeeAmount: z.number().int().positive().optional(),
        currency: z.string().length(3).optional(),
        electionIntervalMonths: z.number().int().min(1).max(60).optional(),
      })
      .parse(req.body);
    let nextElectionAt = club.nextElectionAt;
    if (body.electionIntervalMonths && body.electionIntervalMonths !== club.electionIntervalMonths) {
      const last = await prisma.election.findFirst({
        where: { clubId: club.id, status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
      });
      const base = last?.completedAt || club.charterDate;
      nextElectionAt = addMonths(base, body.electionIntervalMonths);
    }
    const updated = await prisma.club.update({
      where: { id: club.id },
      data: {
        membershipFeeAmount: body.membershipFeeAmount,
        currency: body.currency?.toUpperCase(),
        electionIntervalMonths: body.electionIntervalMonths,
        nextElectionAt,
      },
    });
    await writeAudit({
      actorId: actor.id,
      action: "club.billing",
      entityType: "Club",
      entityId: club.id,
      snapshot: { membershipFeeAmount: updated.membershipFeeAmount, electionIntervalMonths: updated.electionIntervalMonths },
    });
    res.json({ club: updated });
  }),
);

clubsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const club = await clubOr404(req.params.id);
    await writeAudit({ actorId: actor.id, action: "club.delete", entityType: "Club", entityId: club.id, snapshot: { name: club.name, slug: club.slug } });
    await prisma.club.delete({ where: { id: club.id } });
    res.json({ ok: true });
  }),
);

clubsRouter.post(
  "/:id/admin",
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const club = await clubOr404(req.params.id);
    const body = z.object({ userId: z.string().min(1) }).parse(req.body);
    const membership = await prisma.membership.findUnique({
      where: { userId_clubId: { userId: body.userId, clubId: club.id } },
    });
    if (!membership || membership.status !== "ACTIVE") {
      throw new HttpError(400, "The Club Admin must already be an active member of this club");
    }
    const appointment = await prisma.$transaction(async (tx) => {
      await tx.clubAdmin.updateMany({ where: { clubId: club.id, endedAt: null }, data: { endedAt: new Date() } });
      return tx.clubAdmin.create({
        data: { clubId: club.id, userId: body.userId, appointedById: actor.id },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    });
    await writeAudit({
      actorId: actor.id,
      action: "club.admin_appoint",
      entityType: "ClubAdmin",
      entityId: appointment.id,
      snapshot: { clubId: club.id, userId: body.userId },
    });
    res.json({ admin: appointment });
  }),
);

clubsRouter.get(
  "/:id/officers",
  asyncHandler(async (req, res) => {
    const club = await clubOr404(req.params.id);
    await assertHqOrClubAdmin(req, club.id);
    const scope = String(req.query.scope || "current");
    if (scope === "current") {
      const officers = await prisma.officerRole.findMany({
        where: { clubId: club.id, endedAt: null },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { title: "asc" },
      });
      res.json({ officers });
      return;
    }
    if (scope !== "past") throw new HttpError(400, "scope must be current or past");
    const rows = await prisma.officerRole.findMany({
      where: { clubId: club.id, endedAt: { not: null } },
      include: { user: { select: { id: true, name: true, email: true } }, election: true },
      orderBy: { startedAt: "desc" },
    });
    const groups = new Map<string, { key: string; startedAt: Date; endedAt: Date | null; electionId: string | null; officers: typeof rows }>();
    for (const row of rows) {
      const key = row.electionId || `${row.startedAt.toISOString().slice(0, 10)}:${row.endedAt?.toISOString().slice(0, 10) || ""}`;
      const group = groups.get(key) || { key, startedAt: row.startedAt, endedAt: row.endedAt, electionId: row.electionId, officers: [] };
      group.officers.push(row);
      if (row.startedAt < group.startedAt) group.startedAt = row.startedAt;
      groups.set(key, group);
    }
    res.json({ terms: [...groups.values()] });
  }),
);

clubsRouter.put(
  "/:id/officers",
  asyncHandler(async (req, res) => {
    const club = await clubOr404(req.params.id);
    const actor = await assertHqOrClubAdmin(req, club.id);
    const open = await prisma.election.findFirst({ where: { clubId: club.id, status: { in: ["NOMINATION", "VOTING"] } } });
    if (open) throw new HttpError(400, "Officers are chosen by the open election");
    const body = z
      .object({
        officers: z.array(z.object({ title: z.enum(TITLES), userId: z.string().nullable() })),
      })
      .parse(req.body);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const entry of body.officers) {
        if (entry.userId) {
          const membership = await tx.membership.findUnique({ where: { userId_clubId: { userId: entry.userId, clubId: club.id } } });
          if (!membership || membership.status !== "ACTIVE") throw new HttpError(400, "Officers must be active members");
        }
        const current = await tx.officerRole.findFirst({ where: { clubId: club.id, title: entry.title, endedAt: null } });
        if (current?.userId === entry.userId) continue;
        if (current) {
          await tx.officerRole.update({ where: { id: current.id }, data: { endedAt: now } });
        }
        if (entry.userId) {
          await tx.officerRole.create({ data: { clubId: club.id, userId: entry.userId, title: entry.title, startedAt: now } });
        }
      }
    });
    await writeAudit({ actorId: actor.id, action: "club.officers_assign", entityType: "Club", entityId: club.id });
    const officers = await prisma.officerRole.findMany({
      where: { clubId: club.id, endedAt: null },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json({ officers });
  }),
);

clubsRouter.get(
  "/:id/members",
  asyncHandler(async (req, res) => {
    const club = await clubOr404(req.params.id);
    await assertStaff(req, club.id);
    const members = await prisma.membership.findMany({
      where: { clubId: club.id },
      include: { user: { select: { id: true, name: true, email: true, phone: true, city: true, status: true, occupation: true } } },
      orderBy: [{ status: "asc" }, { joinedAt: "asc" }],
    });
    res.json({
      members: members.map((row) => ({
        membershipId: row.id,
        status: row.status,
        joinedAt: row.joinedAt,
        endedAt: row.endedAt,
        user: row.user,
      })),
    });
  }),
);

clubsRouter.get(
  "/:id/members/export",
  asyncHandler(async (req, res) => {
    const club = await clubOr404(req.params.id);
    await assertClubAdmin(requireUser(req).id, club.id);
    const members = await prisma.membership.findMany({
      where: { clubId: club.id },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    });
    const csv = stringify(
      members.map((row) => ({
        email: row.user.email,
        name: row.user.name,
        phone: row.user.phone || "",
        city: row.user.city || "",
        status: row.status,
        joinedAt: row.joinedAt.toISOString().slice(0, 10),
      })),
      { header: true },
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${club.slug}-members.csv"`);
    res.send(csv);
  }),
);

clubsRouter.post(
  "/:id/members/import",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const club = await clubOr404(req.params.id);
    await assertClubAdmin(requireUser(req).id, club.id);
    if (!req.file) throw new HttpError(400, "Upload a CSV file");
    const rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const email = (row.email || "").toLowerCase();
      const name = row.name || "";
      if (!email || !name) continue;
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name,
            phone: row.phone || null,
            city: row.city || null,
            gender: row.gender || null,
            occupation: row.occupation || null,
            status: "INVITED",
          },
        });
        created += 1;
      } else {
        updated += 1;
      }
      await prisma.membership.upsert({
        where: { userId_clubId: { userId: user.id, clubId: club.id } },
        create: { userId: user.id, clubId: club.id, status: "ACTIVE" },
        update: { status: "ACTIVE", endedAt: null },
      });
    }
    res.json({ created, updated, rows: rows.length });
  }),
);

clubsRouter.post(
  "/:id/members/:userId/reinstate",
  asyncHandler(async (req, res) => {
    const club = await clubOr404(req.params.id);
    const actor = await assertHqOrClubAdmin(req, club.id);
    const member = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!member) throw new HttpError(404, "Member not found");
    const membership = await prisma.membership.findUnique({
      where: { userId_clubId: { userId: member.id, clubId: club.id } },
    });
    if (!membership || membership.status === "ACTIVE") throw new HttpError(400, "Only a former member can be reinstated");
    const { randomToken } = await import("../lib/auth");
    const { addDays } = await import("../lib/dates");
    const { sendApplicationLink } = await import("../lib/mailer");
    const token = randomToken();
    const application = await prisma.membershipApplication.create({
      data: {
        clubId: club.id,
        email: member.email,
        kind: "REINSTATE",
        token,
        userId: member.id,
        createdById: actor.id,
        expiresAt: addDays(new Date(), 14),
        formJson: {
          name: member.name,
          email: member.email,
          phone: member.phone,
          dateOfBirth: member.dateOfBirth ? member.dateOfBirth.toISOString().slice(0, 10) : null,
          gender: member.gender,
          address: member.address,
          city: member.city,
          occupation: member.occupation,
          goals: member.goals,
        },
      },
    });
    const url = `${process.env.WEB_ORIGIN || "http://localhost:3000"}/apply/${token}`;
    await sendApplicationLink(member.email, club.name, url, "REINSTATE");
    await writeAudit({
      actorId: actor.id,
      action: "membership.reinstate_link",
      entityType: "MembershipApplication",
      entityId: application.id,
      snapshot: { userId: member.id, clubId: club.id },
    });
    res.status(201).json({ applicationId: application.id, url });
  }),
);

clubsRouter.get(
  "/:id/dues",
  asyncHandler(async (req, res) => {
    const club = await clubOr404(req.params.id);
    await assertClubAdmin(requireUser(req).id, club.id);
    const invoices = await prisma.duesInvoice.findMany({
      where: { clubId: club.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ invoices });
  }),
);
