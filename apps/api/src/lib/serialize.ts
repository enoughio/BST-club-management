import type { User } from "@prisma/client";
import { prisma } from "./prisma";

const userSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  dateOfBirth: true,
  gender: true,
  address: true,
  city: true,
  occupation: true,
  goals: true,
  school: true,
  grade: true,
  guardianName: true,
  guardianPhone: true,
  guardianEmail: true,
  secondGuardianName: true,
  secondGuardianPhone: true,
  secondGuardianEmail: true,
  consentPhoto: true,
  consentParticipation: true,
  consentData: true,
  avatarKey: true,
  role: true,
  status: true,
} as const;

export function publicFileUrl(key: string | null | undefined) {
  if (!key) return null;
  return `/api/v1/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function userCore(user: Pick<User, "id" | "email" | "name" | "phone" | "dateOfBirth" | "gender" | "address" | "city" | "occupation" | "goals" | "school" | "grade" | "guardianName" | "guardianPhone" | "guardianEmail" | "secondGuardianName" | "secondGuardianPhone" | "secondGuardianEmail" | "consentPhoto" | "consentParticipation" | "consentData" | "avatarKey" | "role" | "status">) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    address: user.address,
    city: user.city,
    occupation: user.occupation,
    goals: user.goals,
    school: user.school,
    grade: user.grade,
    guardianName: user.guardianName,
    guardianPhone: user.guardianPhone,
    guardianEmail: user.guardianEmail,
    secondGuardianName: user.secondGuardianName,
    secondGuardianPhone: user.secondGuardianPhone,
    secondGuardianEmail: user.secondGuardianEmail,
    consentPhoto: user.consentPhoto,
    consentParticipation: user.consentParticipation,
    consentData: user.consentData,
    avatarUrl: publicFileUrl(user.avatarKey),
    role: user.role,
    status: user.status,
  };
}

export async function sessionFor(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  if (!user) return null;
  const [memberships, admins, offices] = await Promise.all([
    prisma.membership.findMany({
      where: { userId },
      include: { club: { select: { id: true, name: true, slug: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.clubAdmin.findMany({
      where: { userId, endedAt: null },
      include: { club: { select: { id: true, name: true } } },
    }),
    prisma.officerRole.findMany({
      where: { userId, endedAt: null },
      include: { club: { select: { id: true, name: true } } },
    }),
  ]);
  return {
    ...userCore(user),
    memberships: memberships.map((row) => ({
      id: row.id,
      clubId: row.clubId,
      clubName: row.club.name,
      clubSlug: row.club.slug,
      status: row.status,
      joinedAt: row.joinedAt,
      endedAt: row.endedAt,
    })),
    adminClubs: admins.map((row) => ({ clubId: row.clubId, clubName: row.club.name })),
    offices: offices.map((row) => ({ clubId: row.clubId, clubName: row.club.name, title: row.title })),
  };
}

export const TITLES = [
  "PRESIDENT",
  "VP_EDUCATION",
  "VP_MEMBERSHIP",
  "VP_PUBLIC_RELATIONS",
  "SECRETARY",
  "TREASURER",
  "SERGEANT_AT_ARMS",
] as const;

export const AGENDA_ROLES = [
  "PREPARED_SPEAKER",
  "TIMEKEEPER",
  "FILLER_COUNTER",
  "LISTENER",
  "LANGUAGE_EVALUATOR",
  "OPEN_MIC_COORDINATOR",
  "MOC",
  "CHIEF_EVALUATOR",
  "SPEECH_EVALUATOR",
] as const;

const SPECIAL_LABELS: Record<string, string> = {
  MOC: "Master of Ceremony",
  VP_EDUCATION: "VP Education",
  VP_MEMBERSHIP: "VP Membership",
  VP_PUBLIC_RELATIONS: "VP Public Relations",
  SERGEANT_AT_ARMS: "Sergeant at Arms",
};

export function roleLabel(role: string) {
  if (SPECIAL_LABELS[role]) return SPECIAL_LABELS[role];
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
