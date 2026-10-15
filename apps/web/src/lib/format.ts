export function money(amount: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount / 100);
  } catch {
    return `${currency} ${(amount / 100).toFixed(2)}`;
  }
}

export function when(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function relativeWhen(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.round((Date.now() - date.getTime()) / 86400000);
  if (days < 1) return "joined today";
  if (days < 30) return `joined ${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `joined ${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.max(1, Math.round(months / 12));
  return `joined ${years} year${years === 1 ? "" : "s"} ago`;
}

const SPECIAL_LABELS: Record<string, string> = {
  MOC: "Master of Ceremony",
  VP_EDUCATION: "VP Education",
  VP_MEMBERSHIP: "VP Membership",
  VP_PUBLIC_RELATIONS: "VP Public Relations",
  SERGEANT_AT_ARMS: "Sergeant at Arms",
};

export function titleCase(value: string) {
  if (SPECIAL_LABELS[value]) return SPECIAL_LABELS[value];
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
