import { Router } from "express";
import { z } from "zod";
import { assertActiveMember, assertClubAdmin, assertHqOrClubAdmin, clubOr404, requireSuperAdmin, requireUser } from "../lib/access";
import { writeAudit } from "../lib/audit";
import { HttpError } from "../lib/errors";
import { asyncHandler } from "../lib/http";
import { sendRemovalDecision, sendRemovalRequested } from "../lib/mailer";
import { notifyUser, notifyUsers } from "../lib/notify";
import { prisma } from "../lib/prisma";
import { TITLES } from "../lib/serialize";

export const governanceRouter = Router();

governanceRouter.get(
  "/clubs/:id/elections",
  asyncHandler(async (req, res) => {
    const club = await clubOr404(req.params.id);
    await assertActiveMember(requireUser(req).id, club.id);
    const elections = await prisma.election.findMany({
      where: { clubId: club.id },
      orderBy: { createdAt: "desc" },
      include: {
        nominations: { include: { user: { select: { id: true, name: true } } } },
        votes: true,
      },
    });
    res.json({ elections, nextElectionAt: club.nextElectionAt, electionIntervalMonths: club.electionIntervalMonths });
  }),
);

governanceRouter.post(
  "/clubs/:id/elections/:electionId/nominations",
  asyncHandler(async (req, res) => {
    const club = await clubOr404(req.params.id);
    const user = requireUser(req);
    await assertActiveMember(user.id, club.id);
    const election = await prisma.election.findFirst({ where: { id: req.params.electionId, clubId: club.id } });
    if (!election || election.status !== "NOMINATION") throw new HttpError(400, "Nominations are closed");
    const body = z.object({ title: z.enum(TITLES) }).parse(req.body);
    const nomination = await prisma.nomination.upsert({
      where: { electionId_userId_title: { electionId: election.id, userId: user.id, title: body.title } },
      create: { electionId: election.id, userId: user.id, title: body.title },
      update: {},
    });
    res.status(201).json({ nomination });
  }),
);

governanceRouter.post(
  "/clubs/:id/elections/:electionId/votes",
  asyncHandler(async (req, res) => {
    const club = await clubOr404(req.params.id);
    const user = requireUser(req);
    await assertActiveMember(user.id, club.id);
    const election = await prisma.election.findFirst({ where: { id: req.params.electionId, clubId: club.id } });
    if (!election || election.status !== "VOTING") throw new HttpError(400, "Voting is closed");
    const body = z.object({ title: z.enum(TITLES), candidateId: z.string() }).parse(req.body);
    const nomination = await prisma.nomination.findFirst({
      where: { electionId: election.id, title: body.title, userId: body.candidateId },
    });
    if (!nomination) throw new HttpError(400, "That member is not nominated for this title");
    const vote = await prisma.vote.upsert({
      where: { electionId_voterId_title: { electionId: election.id, voterId: user.id, title: body.title } },
      create: { electionId: election.id, voterId: user.id, title: body.title, candidateId: body.candidateId },
      update: { candidateId: body.candidateId },
    });
    res.json({ vote });
  }),
);

governanceRouter.get(
  "/clubs/:id/elections/:electionId/results",
  asyncHandler(async (req, res) => {
    const club = await clubOr404(req.params.id);
    await assertActiveMember(requireUser(req).id, club.id);
    const election = await prisma.election.findFirst({
      where: { id: req.params.electionId, clubId: club.id },
      include: { nominations: { include: { user: { select: { id: true, name: true } } } }, votes: true, officers: { include: { user: { select: { id: true, name: true } } } } },
    });
    if (!election) throw new HttpError(404, "Election not found");
    const results = TITLES.map((title) => {
      const candidates = election.nominations.filter((row) => row.title === title);
      const counts = candidates.map((candidate) => ({
        userId: candidate.userId,
        name: candidate.user.name,
        votes: election.votes.filter((vote) => vote.title === title && vote.candidateId === candidate.userId).length,
      }));
      return { title, candidates: counts };
    });
    res.json({ election: { id: election.id, status: election.status, completedAt: election.completedAt }, results, officers: election.officers });
  }),
);

governanceRouter.post(
  "/clubs/:id/removals",
  asyncHandler(async (req, res) => {
    const club = await clubOr404(req.params.id);
    const actor = await assertHqOrClubAdmin(req, club.id);
    const body = z
      .object({
        userId: z.string(),
        reason: z.enum(["RESIGNATION", "DUES_UNPAID", "OTHER"]),
        details: z.string().max(1000).optional().nullable(),
      })
      .parse(req.body);
    const membership = await prisma.membership.findUnique({ where: { userId_clubId: { userId: body.userId, clubId: club.id } } });
    if (!membership || membership.status !== "ACTIVE") throw new HttpError(400, "Only an active member can be removed");
    if (body.userId === actor.id) throw new HttpError(400, "Use a different administrator to request your own removal");
    const open = await prisma.removalRequest.findFirst({ where: { clubId: club.id, userId: body.userId, status: "PENDING" } });
    if (open) throw new HttpError(409, "A removal request is already pending");
    const request = await prisma.removalRequest.create({
      data: { clubId: club.id, userId: body.userId, reason: body.reason, details: body.details || null, requesterId: actor.id },
      include: { user: { select: { name: true } } },
    });
    await writeAudit({
      actorId: actor.id,
      action: "removal.request",
      entityType: "RemovalRequest",
      entityId: request.id,
      snapshot: { userId: body.userId, clubId: club.id, reason: body.reason },
    });
    const supers = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } });
    await notifyUsers(supers.map((row) => row.id), "Removal requested", `${request.user.name} — ${club.name}`, "/hq/removals");
    await Promise.all(
      supers.map((row) => sendRemovalRequested(row.email, club.name, request.user.name, body.reason).catch((error) => console.error(error))),
    );
    res.status(201).json({ removal: request });
  }),
);

governanceRouter.get(
  "/clubs/:id/removals",
  asyncHandler(async (req, res) => {
    const club = await clubOr404(req.params.id);
    await assertClubAdmin(requireUser(req).id, club.id);
    const removals = await prisma.removalRequest.findMany({
      where: { clubId: club.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        requester: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ removals });
  }),
);

governanceRouter.get(
  "/removals",
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    const status = String(req.query.status || "PENDING");
    const removals = await prisma.removalRequest.findMany({
      where: status === "ALL" ? {} : { status: status as "PENDING" },
      include: {
        club: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
        requester: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ removals });
  }),
);

governanceRouter.post(
  "/removals/:id/approve",
  asyncHandler(async (req, res) => decideRemoval(req, res, true)),
);

governanceRouter.post(
  "/removals/:id/reject",
  asyncHandler(async (req, res) => decideRemoval(req, res, false)),
);

async function decideRemoval(req: Parameters<typeof requireSuperAdmin>[0], res: { json: (body: unknown) => void }, approved: boolean) {
  const actor = requireSuperAdmin(req);
  const request = await prisma.removalRequest.findUnique({
    where: { id: req.params.id },
    include: { club: true, user: true, requester: true },
  });
  if (!request) throw new HttpError(404, "Removal request not found");
  if (request.status !== "PENDING") throw new HttpError(400, "This request is already decided");
  await prisma.$transaction(async (tx) => {
    await tx.removalRequest.update({
      where: { id: request.id },
      data: { status: approved ? "APPROVED" : "REJECTED", decidedById: actor.id, decidedAt: new Date() },
    });
    if (approved) {
      await tx.membership.update({
        where: { userId_clubId: { userId: request.userId, clubId: request.clubId } },
        data: { status: "REMOVED", endedAt: new Date() },
      });
      await tx.officerRole.updateMany({
        where: { userId: request.userId, clubId: request.clubId, endedAt: null },
        data: { endedAt: new Date() },
      });
      await tx.clubAdmin.updateMany({
        where: { userId: request.userId, clubId: request.clubId, endedAt: null },
        data: { endedAt: new Date() },
      });
    }
  });
  await writeAudit({
    actorId: actor.id,
    action: approved ? "removal.approve" : "removal.reject",
    entityType: "RemovalRequest",
    entityId: request.id,
    snapshot: { userId: request.userId, clubId: request.clubId },
  });
  await notifyUser(request.requesterId, approved ? "Removal approved" : "Removal rejected", `${request.user.name} — ${request.club.name}`, `/club/${request.clubId}/removals`);
  await sendRemovalDecision(request.requester.email, request.club.name, request.user.name, approved);
  res.json({ ok: true, status: approved ? "APPROVED" : "REJECTED" });
}
