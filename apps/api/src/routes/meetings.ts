import { AgendaRole, Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { assertClubAdmin, assertClubAdminOrPresident, assertStaff, clubOr404, currentClubAdmin, currentOfficer, requireUser } from "../lib/access";
import { writeAudit } from "../lib/audit";
import { meetingMoment, parseDateOnly, startOfUtcDay } from "../lib/dates";
import { HttpError } from "../lib/errors";
import { asyncHandler } from "../lib/http";
import { sendMeetingNotice } from "../lib/mailer";
import { notifyUsers } from "../lib/notify";
import { prisma } from "../lib/prisma";
import { AGENDA_ROLES, roleLabel } from "../lib/serialize";

export const meetingsRouter = Router();

const SINGLETON: AgendaRole[] = [
  "TIMEKEEPER",
  "FILLER_COUNTER",
  "LISTENER",
  "LANGUAGE_EVALUATOR",
  "OPEN_MIC_COORDINATOR",
  "MOC",
  "CHIEF_EVALUATOR",
];

const agendaItemSchema = z.object({
  sortOrder: z.number().int().min(0),
  role: z.enum(AGENDA_ROLES),
  title: z.string().min(1).max(160),
  assigneeId: z.string().nullable().optional(),
  targetUserId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  durationMin: z.number().int().min(1).max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const meetingFields = {
  title: z.string().min(2).max(160),
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  place: z.string().min(2).max(160),
};

meetingsRouter.get(
  "/clubs/:id/meetings",
  asyncHandler(async (req, res) => {
    const club = await clubOr404(req.params.id);
    const user = requireUser(req);
    const isSuper = user.role === "SUPER_ADMIN";
    const isAdmin = Boolean(await currentClubAdmin(user.id, club.id));
    const office = await currentOfficer(user.id, club.id);
    if (!isSuper && !isAdmin && !office) throw new HttpError(403, "Club staff access required");
    let scope = String(req.query.scope || "all");
    const limitedOfficer = !isSuper && !isAdmin && office?.title !== "PRESIDENT";
    if (limitedOfficer) scope = "upcoming";
    const today = startOfUtcDay();
    const where: Prisma.MeetingWhereInput = { clubId: club.id };
    if (limitedOfficer) {
      where.OR = [
        { status: "FINALIZED", meetingDate: { gte: today } },
        { status: "COMPLETED" },
      ];
    } else if (scope === "upcoming") {
      where.OR = [
        { status: "DRAFT" },
        { status: "FINALIZED", meetingDate: { gte: today } },
      ];
    } else if (scope === "past") {
      where.OR = [
        { status: { in: ["COMPLETED", "CANCELLED"] } },
        { status: "FINALIZED", meetingDate: { lt: today } },
      ];
    } else if (scope !== "all") {
      throw new HttpError(400, "scope must be upcoming, past, or all");
    }
    const meetings = await prisma.meeting.findMany({
      where,
      orderBy: { meetingDate: "desc" },
      include: { _count: { select: { agenda: true, rsvps: true, attendance: true } } },
    });
    res.json({ meetings });
  }),
);

meetingsRouter.post(
  "/clubs/:id/meetings",
  asyncHandler(async (req, res) => {
    const club = await clubOr404(req.params.id);
    const user = await assertClubAdminOrPresident(req, club.id);
    const body = z.object(meetingFields).parse(req.body);
    const meetingDate = parseDateOnly(body.meetingDate);
    await assertDateFree(club.id, meetingDate);
    const meeting = await prisma.meeting.create({
      data: {
        clubId: club.id,
        title: body.title,
        meetingDate,
        startTime: body.startTime,
        endTime: body.endTime,
        place: body.place,
        status: "DRAFT",
        createdById: user.id,
      },
    });
    res.status(201).json({ meeting });
  }),
);

meetingsRouter.get(
  "/meetings/:id",
  asyncHandler(async (req, res) => {
    const meeting = await loadMeeting(req.params.id);
    const user = requireUser(req);
    await assertCanViewMeeting(user, meeting.clubId);
    res.json({ meeting });
  }),
);

meetingsRouter.patch(
  "/meetings/:id",
  asyncHandler(async (req, res) => {
    const meeting = await loadMeeting(req.params.id);
    await assertClubAdminOrPresident(req, meeting.clubId);
    if (meeting.status !== "DRAFT") throw new HttpError(400, "Only a draft agenda can be edited");
    const body = z.object({ ...meetingFields, title: meetingFields.title.optional(), meetingDate: meetingFields.meetingDate.optional(), startTime: meetingFields.startTime.optional(), endTime: meetingFields.endTime.optional(), place: meetingFields.place.optional(), agenda: z.array(agendaItemSchema).optional() }).parse(req.body);
    if (body.meetingDate) {
      const meetingDate = parseDateOnly(body.meetingDate);
      await assertDateFree(meeting.clubId, meetingDate, meeting.id);
    }
    if (body.agenda) await assertAgenda(meeting.clubId, body.agenda);
    const updated = await prisma.$transaction(async (tx) => {
      if (body.agenda) {
        await tx.agendaItem.deleteMany({ where: { meetingId: meeting.id } });
        await tx.agendaItem.createMany({
          data: body.agenda.map((item) => ({
            meetingId: meeting.id,
            sortOrder: item.sortOrder,
            role: item.role,
            title: item.title,
            assigneeId: item.assigneeId || null,
            targetUserId: item.targetUserId || null,
            projectId: item.projectId || null,
            durationMin: item.durationMin || null,
            notes: item.notes || null,
          })),
        });
      }
      return tx.meeting.update({
        where: { id: meeting.id },
        data: {
          title: body.title,
          meetingDate: body.meetingDate ? parseDateOnly(body.meetingDate) : undefined,
          startTime: body.startTime,
          endTime: body.endTime,
          place: body.place,
        },
        include: meetingInclude,
      });
    });
    res.json({ meeting: updated });
  }),
);

meetingsRouter.delete(
  "/meetings/:id",
  asyncHandler(async (req, res) => {
    const meeting = await loadMeeting(req.params.id);
    await assertClubAdminOrPresident(req, meeting.clubId);
    if (meeting.status !== "DRAFT") throw new HttpError(400, "Only a draft can be discarded");
    await prisma.meeting.delete({ where: { id: meeting.id } });
    res.json({ ok: true });
  }),
);

meetingsRouter.post(
  "/meetings/:id/finalize",
  asyncHandler(async (req, res) => {
    const meeting = await loadMeeting(req.params.id);
    const actor = await assertClubAdminOrPresident(req, meeting.clubId);
    if (meeting.status !== "DRAFT") throw new HttpError(400, "Only a draft can be finalized");
    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: "FINALIZED", finalizedAt: new Date() },
      include: meetingInclude,
    });
    await emailMeeting(updated, false);
    await writeAudit({ actorId: actor.id, action: "meeting.finalize", entityType: "Meeting", entityId: meeting.id });
    res.json({ meeting: updated });
  }),
);

meetingsRouter.post(
  "/meetings/:id/cancel",
  asyncHandler(async (req, res) => {
    const meeting = await loadMeeting(req.params.id);
    const actor = requireUser(req);
    await assertClubAdmin(actor.id, meeting.clubId);
    if (meeting.status !== "FINALIZED") throw new HttpError(400, "Only a finalized meeting can be cancelled");
    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
      include: meetingInclude,
    });
    await emailMeeting(updated, true);
    await writeAudit({ actorId: actor.id, action: "meeting.cancel", entityType: "Meeting", entityId: meeting.id });
    res.json({ meeting: updated });
  }),
);

meetingsRouter.post(
  "/meetings/:id/complete",
  asyncHandler(async (req, res) => {
    const meeting = await loadMeeting(req.params.id);
    const actor = requireUser(req);
    await assertClubAdmin(actor.id, meeting.clubId);
    if (meeting.status !== "FINALIZED") throw new HttpError(400, "Only a finalized meeting can be completed");
    const end = meetingMoment(meeting.meetingDate, meeting.endTime);
    if (new Date() < end) throw new HttpError(400, "The meeting can be completed after its scheduled end time");
    const body = z.object({ summary: z.string().max(4000).optional() }).parse(req.body || {});
    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: "COMPLETED", completedAt: new Date(), summary: body.summary },
      include: meetingInclude,
    });
    res.json({ meeting: updated });
  }),
);

meetingsRouter.patch(
  "/meetings/:id/summary",
  asyncHandler(async (req, res) => {
    const meeting = await loadMeeting(req.params.id);
    await assertClubAdmin(requireUser(req).id, meeting.clubId);
    const body = z.object({ summary: z.string().max(4000) }).parse(req.body);
    const updated = await prisma.meeting.update({ where: { id: meeting.id }, data: { summary: body.summary } });
    res.json({ meeting: updated });
  }),
);

meetingsRouter.post(
  "/meetings/:id/rsvp",
  asyncHandler(async (req, res) => {
    const meeting = await loadMeeting(req.params.id);
    const user = requireUser(req);
    const membership = await prisma.membership.findUnique({ where: { userId_clubId: { userId: user.id, clubId: meeting.clubId } } });
    if (!membership || membership.status !== "ACTIVE") throw new HttpError(403, "Active membership required");
    if (meeting.status !== "FINALIZED") throw new HttpError(400, "RSVP opens after the agenda is finalized");
    const body = z.object({ status: z.enum(["YES", "NO", "MAYBE"]) }).parse(req.body);
    const rsvp = await prisma.rsvp.upsert({
      where: { meetingId_userId: { meetingId: meeting.id, userId: user.id } },
      create: { meetingId: meeting.id, userId: user.id, status: body.status },
      update: { status: body.status },
    });
    res.json({ rsvp });
  }),
);

meetingsRouter.put(
  "/meetings/:id/attendance",
  asyncHandler(async (req, res) => {
    const meeting = await loadMeeting(req.params.id);
    const actor = await assertStaff(req, meeting.clubId);
    const body = z.object({ records: z.array(z.object({ userId: z.string(), present: z.boolean() })) }).parse(req.body);
    await prisma.$transaction(
      body.records.map((record) =>
        prisma.attendance.upsert({
          where: { meetingId_userId: { meetingId: meeting.id, userId: record.userId } },
          create: { meetingId: meeting.id, userId: record.userId, present: record.present, markedById: actor.id },
          update: { present: record.present, markedById: actor.id },
        }),
      ),
    );
    const attendance = await prisma.attendance.findMany({
      where: { meetingId: meeting.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json({ attendance });
  }),
);

meetingsRouter.post(
  "/meetings/:id/feedback",
  asyncHandler(async (req, res) => {
    const meeting = await loadMeeting(req.params.id);
    const user = requireUser(req);
    if (meeting.status !== "COMPLETED") throw new HttpError(400, "Feedback opens after the meeting is completed");
    const body = z
      .object({
        agendaItemId: z.string(),
        comments: z.string().min(1).max(4000),
        score: z.number().int().min(0).max(100),
        approved: z.boolean(),
      })
      .parse(req.body);
    const item = meeting.agenda.find((row) => row.id === body.agendaItemId);
    if (!item || item.role !== "SPEECH_EVALUATOR" || item.assigneeId !== user.id) {
      throw new HttpError(403, "Only the assigned speech evaluator can submit this feedback");
    }
    const speaker = meeting.agenda.find((row) => row.role === "PREPARED_SPEAKER" && row.assigneeId === item.targetUserId);
    if (!speaker?.assigneeId || !speaker.projectId) throw new HttpError(400, "This speech has no project to approve");
    const existing = await prisma.memberProject.findUnique({
      where: { userId_projectId: { userId: speaker.assigneeId, projectId: speaker.projectId } },
    });
    if (existing?.approved) throw new HttpError(409, "This project is already approved");
    const saved = await prisma.$transaction(async (tx) => {
      const progress = await tx.memberProject.upsert({
        where: { userId_projectId: { userId: speaker.assigneeId!, projectId: speaker.projectId! } },
        create: {
          userId: speaker.assigneeId!,
          projectId: speaker.projectId!,
          score: body.score,
          feedback: body.comments,
          approved: body.approved,
          evaluatorId: user.id,
          meetingId: meeting.id,
          approvedAt: body.approved ? new Date() : null,
        },
        update: {
          score: body.score,
          feedback: body.comments,
          approved: body.approved,
          evaluatorId: user.id,
          meetingId: meeting.id,
          approvedAt: body.approved ? new Date() : null,
        },
        include: { project: true },
      });
      if (body.approved) {
        await tx.certificate.upsert({
          where: { memberProjectId: progress.id },
          create: {
            userId: speaker.assigneeId!,
            memberProjectId: progress.id,
            title: `${progress.project.title} certificate`,
          },
          update: {},
        });
      }
      return progress;
    });
    res.json({ memberProject: saved });
  }),
);

const meetingInclude = {
  club: { select: { id: true, name: true } },
  agenda: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      targetUser: { select: { id: true, name: true } },
      project: { select: { id: true, title: true } },
    },
  },
  rsvps: { include: { user: { select: { id: true, name: true } } } },
  attendance: { include: { user: { select: { id: true, name: true, email: true } } } },
};

async function loadMeeting(id: string) {
  const meeting = await prisma.meeting.findUnique({ where: { id }, include: meetingInclude });
  if (!meeting) throw new HttpError(404, "Meeting not found");
  return meeting;
}

async function assertCanViewMeeting(user: { id: string; role: string }, clubId: string) {
  if (user.role === "SUPER_ADMIN") return;
  const admin = await prisma.clubAdmin.findFirst({ where: { userId: user.id, clubId, endedAt: null } });
  if (admin) return;
  const member = await prisma.membership.findUnique({ where: { userId_clubId: { userId: user.id, clubId } } });
  if (!member) throw new HttpError(403, "You cannot view this meeting");
}

async function assertDateFree(clubId: string, meetingDate: Date, ignoreId?: string) {
  const clash = await prisma.meeting.findFirst({
    where: { clubId, meetingDate, status: { not: "CANCELLED" }, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
  });
  if (clash) throw new HttpError(409, "This club already has a meeting on that date");
}

async function assertAgenda(
  clubId: string,
  items: z.infer<typeof agendaItemSchema>[],
) {
  const members = await prisma.membership.findMany({ where: { clubId, status: "ACTIVE" }, select: { userId: true } });
  const active = new Set(members.map((row) => row.userId));
  const seenUsers = new Set<string>();
  const seenRoles = new Set<string>();
  const speakers = new Set<string>();
  const evaluated = new Set<string>();
  for (const item of items) {
    if (item.assigneeId) {
      if (!active.has(item.assigneeId)) throw new HttpError(400, "Every assignment must be an active member of this club");
      if (seenUsers.has(item.assigneeId)) throw new HttpError(400, "A member can hold only one assignment in a meeting");
      seenUsers.add(item.assigneeId);
    }
    if (SINGLETON.includes(item.role)) {
      if (seenRoles.has(item.role)) throw new HttpError(400, `${roleLabel(item.role)} can be assigned only once`);
      seenRoles.add(item.role);
    }
    if (item.role === "PREPARED_SPEAKER") {
      if (!item.assigneeId) throw new HttpError(400, "A prepared speaker must be assigned");
      speakers.add(item.assigneeId);
    }
    if (item.role === "SPEECH_EVALUATOR") {
      if (!item.assigneeId || !item.targetUserId) throw new HttpError(400, "A speech evaluator must be linked to a prepared speaker");
      if (item.assigneeId === item.targetUserId) throw new HttpError(400, "A speaker cannot evaluate their own speech");
      if (evaluated.has(item.targetUserId)) throw new HttpError(400, "Each prepared speaker has one speech evaluator");
      evaluated.add(item.targetUserId);
    }
  }
  for (const target of evaluated) {
    if (!speakers.has(target)) throw new HttpError(400, "Speech evaluators must point at a prepared speaker");
  }
}

async function emailMeeting(
  meeting: {
    id: string;
    clubId: string;
    title: string;
    meetingDate: Date;
    startTime: string;
    place: string;
    club: { name: string };
    agenda: { role: AgendaRole; assigneeId: string | null; assignee: { name: string } | null }[];
  },
  cancelled: boolean,
) {
  const members = await prisma.membership.findMany({
    where: { clubId: meeting.clubId, status: "ACTIVE" },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  const when = `${meeting.meetingDate.toISOString().slice(0, 10)} ${meeting.startTime}`;
  await notifyUsers(
    members.map((member) => member.user.id),
    cancelled ? "Meeting cancelled" : "Meeting finalized",
    `${meeting.club.name}: ${meeting.title} on ${when}`,
    `/me/meetings`,
  );
  await Promise.all(
    members.map((member) => {
      const assignment = meeting.agenda.find((item) => item.assigneeId === member.user.id);
      return sendMeetingNotice({
        to: member.user.email,
        clubName: meeting.club.name,
        when,
        place: meeting.place,
        role: assignment ? roleLabel(assignment.role) : null,
        cancelled,
      }).catch((error) => console.error(error));
    }),
  );
}
