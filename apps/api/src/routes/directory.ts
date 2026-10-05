import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { HttpError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { publicFileUrl } from "../lib/serialize";

export const directoryRouter = Router();

directoryRouter.get(
  "/clubs",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const clubs = await prisma.club.findMany({
      where: {
        status: { in: ["ACTIVE", "PROVISIONAL"] },
        ...(q
          ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }] }
          : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        meetingSchedule: true,
        description: true,
        status: true,
        charterDate: true,
      },
    });
    res.json({ clubs });
  }),
);

directoryRouter.get(
  "/clubs/:slug",
  asyncHandler(async (req, res) => {
    const club = await prisma.club.findUnique({
      where: { slug: req.params.slug },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        address: true,
        meetingSchedule: true,
        description: true,
        status: true,
        charterDate: true,
        membershipFeeAmount: true,
        currency: true,
      },
    });
    if (!club || club.status === "INACTIVE") throw new HttpError(404, "Club not found");
    res.json({ club });
  }),
);

directoryRouter.get(
  "/members/:id",
  asyncHandler(async (req, res) => {
    const member = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        occupation: true,
        avatarKey: true,
        role: true,
        status: true,
        memberships: { include: { club: { select: { id: true, name: true, slug: true } } } },
      },
    });
    if (!member || member.role === "SUPER_ADMIN") throw new HttpError(404, "Member not found");
    const viewer = req.user;
    let showContact = viewer?.role === "SUPER_ADMIN";
    if (viewer && !showContact) {
      const viewerClubs = await prisma.membership.findMany({ where: { userId: viewer.id, status: "ACTIVE" }, select: { clubId: true } });
      const adminClubs = await prisma.clubAdmin.findMany({ where: { userId: viewer.id, endedAt: null }, select: { clubId: true } });
      const allowed = new Set([...viewerClubs.map((row) => row.clubId), ...adminClubs.map((row) => row.clubId)]);
      showContact = member.memberships.some((row) => row.status === "ACTIVE" && allowed.has(row.clubId));
    }
    res.json({
      member: {
        id: member.id,
        name: member.name,
        city: member.city,
        occupation: showContact ? member.occupation : null,
        avatarUrl: publicFileUrl(member.avatarKey),
        email: showContact ? member.email : null,
        phone: showContact ? member.phone : null,
        clubs: member.memberships
          .filter((row) => row.status === "ACTIVE")
          .map((row) => ({ id: row.club.id, name: row.club.name, slug: row.club.slug })),
      },
    });
  }),
);
