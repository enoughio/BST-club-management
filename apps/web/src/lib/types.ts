export type SessionUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  occupation: string | null;
  goals: string | null;
  avatarUrl: string | null;
  role: "SUPER_ADMIN" | "USER";
  status: string;
  memberships: {
    id: string;
    clubId: string;
    clubName: string;
    clubSlug: string;
    status: string;
    joinedAt: string;
    endedAt: string | null;
  }[];
  adminClubs: { clubId: string; clubName: string }[];
  offices: { clubId: string; clubName: string; title: string }[];
};

export type Club = {
  id: string;
  name: string;
  slug: string;
  city: string;
  address?: string | null;
  meetingSchedule?: string | null;
  description?: string | null;
  charterDate: string;
  status: string;
  membershipFeeAmount: number;
  currency: string;
  electionIntervalMonths: number;
  nextElectionAt: string;
  currentAdmin?: { id: string; name: string; email: string } | null;
};

export type MemberRow = {
  membershipId: string;
  status: string;
  joinedAt: string;
  endedAt: string | null;
  user: { id: string; name: string; email: string; phone?: string | null; city?: string | null; status?: string; occupation?: string | null };
};

export type AgendaItem = {
  id: string;
  sortOrder: number;
  role: string;
  title: string;
  assigneeId: string | null;
  targetUserId: string | null;
  projectId: string | null;
  durationMin: number | null;
  notes: string | null;
  assignee?: { id: string; name: string; email?: string } | null;
  targetUser?: { id: string; name: string } | null;
  project?: { id: string; title: string } | null;
};

export type Meeting = {
  id: string;
  clubId: string;
  title: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  place: string;
  status: string;
  summary: string | null;
  club?: { id: string; name: string };
  agenda?: AgendaItem[];
  rsvps?: { id: string; status: string; userId: string; user?: { id: string; name: string } }[];
  attendance?: { id: string; userId: string; present: boolean; user?: { id: string; name: string; email?: string } }[];
};

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
  "MOC",
  "PREPARED_SPEAKER",
  "SPEECH_EVALUATOR",
  "CHIEF_EVALUATOR",
  "TIMEKEEPER",
  "FILLER_COUNTER",
  "LISTENER",
  "LANGUAGE_EVALUATOR",
  "OPEN_MIC_COORDINATOR",
] as const;

export function homeFor(user: SessionUser) {
  if (user.role === "SUPER_ADMIN") return "/hq";
  if (user.adminClubs[0]) return `/club/${user.adminClubs[0].clubId}`;
  if (user.offices[0]) return `/club/${user.offices[0].clubId}/officer`;
  return "/me";
}
