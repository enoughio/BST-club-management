import type { OfficerTitle, UserRole, UserStatus } from "@prisma/client";
import type { Request } from "express";
import { HttpError } from "./errors";
import { prisma } from "./prisma";

export type RequestUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
};

export function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, "Sign in required");
  if (req.user.status === "SUSPENDED") throw new HttpError(403, "Account suspended");
  return req.user;
}

export function requireSuperAdmin(req: Request) {
  const user = requireUser(req);
  if (user.role !== "SUPER_ADMIN") throw new HttpError(403, "Headquarters access required");
  return user;
}

export async function currentClubAdmin(userId: string, clubId: string) {
  return prisma.clubAdmin.findFirst({
    where: { userId, clubId, endedAt: null },
  });
}

export async function assertClubAdmin(userId: string, clubId: string) {
  const row = await currentClubAdmin(userId, clubId);
  if (!row) throw new HttpError(403, "Club Admin access required");
  return row;
}

export async function assertHqOrClubAdmin(req: Request, clubId: string) {
  const user = requireUser(req);
  if (user.role === "SUPER_ADMIN") return user;
  await assertClubAdmin(user.id, clubId);
  return user;
}

export async function currentOfficer(userId: string, clubId: string, title?: OfficerTitle) {
  return prisma.officerRole.findFirst({
    where: { userId, clubId, endedAt: null, ...(title ? { title } : {}) },
  });
}

export async function assertClubAdminOrPresident(req: Request, clubId: string) {
  const user = requireUser(req);
  if (user.role === "SUPER_ADMIN") return user;
  const admin = await currentClubAdmin(user.id, clubId);
  if (admin) return user;
  const president = await currentOfficer(user.id, clubId, "PRESIDENT");
  if (!president) throw new HttpError(403, "Club Admin or President access required");
  return user;
}

export async function assertStaff(req: Request, clubId: string) {
  const user = requireUser(req);
  if (user.role === "SUPER_ADMIN") return user;
  const admin = await currentClubAdmin(user.id, clubId);
  if (admin) return user;
  const office = await currentOfficer(user.id, clubId);
  if (!office) throw new HttpError(403, "Officer access required");
  return user;
}

export async function activeMembership(userId: string, clubId: string) {
  return prisma.membership.findFirst({
    where: { userId, clubId, status: "ACTIVE" },
  });
}

export async function assertActiveMember(userId: string, clubId: string) {
  const membership = await activeMembership(userId, clubId);
  if (!membership) throw new HttpError(403, "Active membership required");
  return membership;
}

export async function clubOr404(clubId: string) {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) throw new HttpError(404, "Club not found");
  return club;
}
