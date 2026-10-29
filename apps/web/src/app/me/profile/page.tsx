"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { ageOn, gradeLabel, nextBirthday } from "@/lib/child";
import { titleCase, when } from "@/lib/format";
import { useSession } from "@/lib/session";

type Level = { number: number; name: string; unlocked?: boolean; projects: { id: string }[] };
type Progress = { projectId: string; approved: boolean };

export default function ProfilePage() {
  const { user } = useSession();
  const [level, setLevel] = useState<string>("—");
  useEffect(() => {
    api<{ levels: Level[]; progress: Progress[] }>("/me/progress").then((data) => {
      const approved = new Set(data.progress.filter((row) => row.approved).map((row) => row.projectId));
      const current = data.levels.find((item, index) => {
        const open = typeof item.unlocked === "boolean" ? item.unlocked : data.levels.slice(0, index).every((earlier) => earlier.projects.every((project) => approved.has(project.id)));
        return open && !item.projects.every((project) => approved.has(project.id));
      });
      setLevel(current ? `Level ${current.number}: ${current.name}` : data.levels.length ? "Path complete" : "—");
    }).catch(() => undefined);
  }, []);
  if (!user) return null;
  const joined = user.memberships.slice().sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())[0];
  const age = user.dateOfBirth ? ageOn(user.dateOfBirth) : null;
  const birthday = user.dateOfBirth ? nextBirthday(user.dateOfBirth) : null;
  const school = gradeLabel(user.grade);
  const schoolLine = [school, user.school].filter(Boolean).join(" · ");
  const missingConsent = [
    !user.consentPhoto && "photos",
    !user.consentParticipation && "participation",
    !user.consentData && "data handling",
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-4">
      <PageIntro title="Profile" lede="The child on this account, the guardians we write to, and the consent on file." actions={<Button asChild><Link href="/me/profile/edit">Edit profile</Link></Button>} />
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar name={user.name} src={user.avatarUrl} size="lg" />
          <div className="min-w-0">
            <p className="font-serif text-3xl">{user.name}</p>
            <p className="text-sm text-muted-foreground">{age != null ? `${age} years old` : "Date of birth not on file"}</p>
            {schoolLine && <p className="mt-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-900">{schoolLine}</p>}
            {birthday && birthday.days <= 30 && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                Birthday {birthday.days === 0 ? "today" : `in ${birthday.days} day${birthday.days === 1 ? "" : "s"}`} · {when(birthday.date.toISOString())}. The club can mark it at the next meeting.
              </p>
            )}
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Joined</dt><dd>{joined ? when(joined.joinedAt) : "Not a member yet"}</dd></div>
              <div><dt className="text-muted-foreground">Current level</dt><dd>{level}</dd></div>
              <div><dt className="text-muted-foreground">City</dt><dd>{user.city || "Not set"}</dd></div>
              <div><dt className="text-muted-foreground">Login email</dt><dd className="truncate">{user.email}</dd></div>
            </dl>
            {user.memberships.length > 0 && (
              <div className="mt-3 flex flex-col gap-1 text-sm">
                {user.memberships.map((row) => <p key={row.id}>{row.clubName} · {titleCase(row.status)}</p>)}
              </div>
            )}
            <Button className="mt-4" variant="outline" asChild><Link href="/me/history">View full history</Link></Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-2xl">Guardian contact</h2>
          <Button variant="outline" size="sm" asChild><Link href="/me/profile/edit">Edit</Link></Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Dues reminders and meeting notices go to these guardians.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Guardian title="Parent or guardian" name={user.guardianName} phone={user.guardianPhone} email={user.guardianEmail} />
          <Guardian title="Second parent or guardian" name={user.secondGuardianName} phone={user.secondGuardianPhone} email={user.secondGuardianEmail} />
        </div>
      </Card>

      <Card className={`p-4 ${missingConsent.length ? "border-red-300" : "border-blue-200"}`}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-2xl">Guardian consent</h2>
          <span className={`rounded-full px-2 py-1 text-xs ${missingConsent.length ? "bg-red-100 text-red-900" : "bg-blue-100 text-blue-900"}`}>{missingConsent.length ? "Incomplete" : "On file"}</span>
        </div>
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          <ConsentRow label="Photos" ok={user.consentPhoto} />
          <ConsentRow label="Participation" ok={user.consentParticipation} />
          <ConsentRow label="Data handling" ok={user.consentData} />
        </ul>
        {missingConsent.length > 0 && (
          <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">
            <p>Missing signed consent for {missingConsent.join(", ")}.</p>
            <Button className="mt-2" variant="outline" asChild><Link href="/me/profile/edit">Update consent</Link></Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function Guardian({ title, name, phone, email }: { title: string; name: string | null; phone: string | null; email: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 font-medium">{name || "Name not on file"}</p>
      <p className="text-sm">{phone || "Mobile not on file"}</p>
      <p className="truncate text-sm text-muted-foreground">{email || "Email not on file"}</p>
    </div>
  );
}

function ConsentRow({ label, ok }: { label: string; ok: boolean }) {
  return <li className={ok ? "text-blue-900" : "text-red-800"}>{ok ? "On file" : "Missing"} · {label}</li>;
}
