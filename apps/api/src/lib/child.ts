export function upcomingBirthday(value: Date, from = new Date()) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const next = new Date(from.getFullYear(), value.getMonth(), value.getDate());
  if (next < start) next.setFullYear(next.getFullYear() + 1);
  return { date: next, days: Math.round((next.getTime() - start.getTime()) / 86400000) };
}

export function blank(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function noticeEmails(user: { email: string; guardianEmail?: string | null; secondGuardianEmail?: string | null }) {
  const guardians = [user.guardianEmail, user.secondGuardianEmail]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));
  const unique = [...new Set(guardians)];
  return unique.length ? unique : [user.email];
}

type ChildInput = {
  school?: string | null;
  grade?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  secondGuardianName?: string | null;
  secondGuardianPhone?: string | null;
  secondGuardianEmail?: string | null;
  consentPhoto?: boolean;
  consentParticipation?: boolean;
  consentData?: boolean;
};

export function childProfileData(body: ChildInput) {
  const text = ["school", "grade", "guardianName", "guardianPhone", "guardianEmail", "secondGuardianName", "secondGuardianPhone", "secondGuardianEmail"] as const;
  const data: Partial<Record<(typeof text)[number], string | null>> & Pick<ChildInput, "consentPhoto" | "consentParticipation" | "consentData"> = {};
  for (const key of text) {
    if (key in body) data[key] = blank(body[key]);
  }
  if (typeof body.consentPhoto === "boolean") data.consentPhoto = body.consentPhoto;
  if (typeof body.consentParticipation === "boolean") data.consentParticipation = body.consentParticipation;
  if (typeof body.consentData === "boolean") data.consentData = body.consentData;
  return data;
}
