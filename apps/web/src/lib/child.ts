const ROLE_ICONS: Record<string, string> = {
  PREPARED_SPEAKER: "🎤",
  TIMEKEEPER: "⏱️",
  FILLER_COUNTER: "🔢",
  LISTENER: "👂",
  LANGUAGE_EVALUATOR: "📖",
  OPEN_MIC_COORDINATOR: "🎙️",
  MOC: "🎬",
  CHIEF_EVALUATOR: "⭐",
  SPEECH_EVALUATOR: "📝",
};

export function roleIcon(role: string) {
  return ROLE_ICONS[role] || "•";
}

export function ageOn(value: string | Date, on: Date = new Date()) {
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return null;
  let age = on.getFullYear() - birth.getFullYear();
  const month = on.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && on.getDate() < birth.getDate())) age -= 1;
  return age < 0 ? 0 : age;
}

export function ageBracket(age: number) {
  if (age < 6) return "Under 6";
  if (age <= 8) return "Ages 6–8";
  if (age <= 11) return "Ages 9–11";
  if (age <= 14) return "Ages 12–14";
  if (age <= 17) return "Ages 15–17";
  return "18+";
}

export function nextBirthday(value: string | Date, from: Date = new Date()) {
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return null;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const next = new Date(from.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < start) next.setFullYear(next.getFullYear() + 1);
  const days = Math.round((next.getTime() - start.getTime()) / 86400000);
  return { date: next, days };
}

export function gradeLabel(grade?: string | null) {
  if (!grade?.trim()) return null;
  return /^grade\b/i.test(grade.trim()) ? grade.trim() : `Grade ${grade.trim()}`;
}
