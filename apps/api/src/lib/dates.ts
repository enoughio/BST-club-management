export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, last));
  return next;
}

export function addUtcMonths(date: Date, months: number) {
  const next = new Date(date.getTime());
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, last));
  return next;
}

/** Membership end: one year for annual, three months for quarterly, from the payment or activation date. */
export function periodEndsAt(start: Date, feePeriod: "ANNUAL" | "QUARTERLY") {
  return addUtcMonths(start, feePeriod === "QUARTERLY" ? 3 : 12);
}

export function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function meetingMoment(meetingDate: Date, hhmm: string) {
  const [hour, minute] = hhmm.split(":").map((part) => Number(part));
  const year = meetingDate.getUTCFullYear();
  const month = meetingDate.getUTCMonth();
  const day = meetingDate.getUTCDate();
  return new Date(year, month, day, hour || 0, minute || 0, 0, 0);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
