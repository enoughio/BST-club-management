"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MemberActions, type HqMember } from "@/components/member-actions";
import { PageIntro } from "@/components/shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { ageOn, gradeLabel, nextBirthday } from "@/lib/child";
import { feePeriodPhrase, titleCase, when } from "@/lib/format";

type MembershipRow = HqMember["memberships"][number] & {
  id: string;
  clubCity: string | null;
  endedAt?: string | null;
  gradeAtJoin?: string | null;
};

type MemberDetail = HqMember & {
  avatarUrl?: string | null;
  offices?: { clubId: string; clubName?: string; title: string }[];
  memberships: MembershipRow[];
};

const membershipTone: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-900",
  EXPIRED: "bg-yellow-100 text-yellow-950",
  LAPSED: "bg-muted text-muted-foreground",
  REMOVED: "bg-muted text-muted-foreground",
};

export function HqMemberProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<MemberDetail | null>(null);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  function load() {
    api<{ user: MemberDetail }>(`/users/${userId}`)
      .then((data) => {
        setUser(data.user);
        setError("");
      })
      .catch(() => setError("Member not found"));
  }

  useEffect(() => {
    setUser(null);
    setError("");
    setHistoryOpen(false);
    load();
  }, [userId]);

  return <MemberProfileBody user={user} error={error} historyOpen={historyOpen} onHistoryOpenChange={setHistoryOpen} onChanged={load} />;
}

export default function HqMemberPage() {
  const userId = String(useParams().id);
  return <HqMemberProfile userId={userId} />;
}

function MemberProfileBody({
  user,
  error,
  historyOpen,
  onHistoryOpenChange,
  onChanged,
}: {
  user: MemberDetail | null;
  error: string;
  historyOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {

  return (
    <div>
      <PageIntro
        title={user?.name || "Member profile"}
        lede="Headquarters record for this person. Membership history stays closed until you open it, and downloads as its own file."
        actions={
          <>
            <Button variant="outline" asChild><Link href="/hq/members">All members</Link></Button>
            {user && <MemberActions user={user} onChanged={onChanged} />}
          </>
        }
      />
      {error && <p className="text-sm text-muted-foreground">{error}</p>}
      {!user && !error && <Skeleton className="h-80 w-full" />}
      {user && (
        <div className="flex flex-col gap-4">
          <Profile user={user} />
          <MembershipHistory user={user} open={historyOpen} onOpenChange={onHistoryOpenChange} />
        </div>
      )}
    </div>
  );
}

function Profile({ user }: { user: MemberDetail }) {
  const age = user.dateOfBirth ? ageOn(user.dateOfBirth) : null;
  const birthday = user.dateOfBirth ? nextBirthday(user.dateOfBirth) : null;
  const school = [gradeLabel(user.grade), user.school].filter(Boolean).join(" · ");
  const offices = user.offices ?? [];
  const adminClubs = user.adminClubs ?? [];

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar name={user.name} src={user.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-3xl">{user.name}</h2>
            <Badge className={user.status === "SUSPENDED" ? "bg-red-100 text-red-900" : user.status === "ACTIVE" ? "bg-blue-100 text-blue-900" : "bg-yellow-100 text-yellow-950"}>{titleCase(user.status)}</Badge>
            {user.role === "SUPER_ADMIN" && <Badge className="bg-blue-100 text-blue-950">Super Admin</Badge>}
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
          {(adminClubs.length > 0 || offices.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {adminClubs.map((club) => (
                <Badge key={club.clubId} className="bg-red-100 text-red-900">Club Admin · {club.clubName}</Badge>
              ))}
              {offices.map((office) => (
                <Badge key={`${office.clubId}-${office.title}`} className="bg-blue-100 text-blue-950">{titleCase(office.title)}{office.clubName ? ` · ${office.clubName}` : ""}</Badge>
              ))}
            </div>
          )}
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Phone" value={user.phone} />
            <Fact label="City" value={user.city} />
            <Fact label="Address" value={user.address} />
            <Fact label="Date of birth" value={user.dateOfBirth ? when(user.dateOfBirth) : null} />
            <Fact label="Age" value={age != null ? `${age} years` : null} />
            <Fact label="Next birthday" value={birthday ? `${when(birthday.date.toISOString())}${birthday.days <= 30 ? ` · in ${birthday.days} day${birthday.days === 1 ? "" : "s"}` : ""}` : null} />
            <Fact label="Gender" value={user.gender} />
            <Fact label="Occupation" value={user.occupation} />
            <Fact label="School" value={school} />
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-muted-foreground">Goals</dt>
              <dd className="whitespace-pre-wrap">{user.goals?.trim() || "Not on file"}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t pt-5 text-sm md:grid-cols-2">
        <div>
          <h3 className="font-medium">Guardians</h3>
          <dl className="mt-2 grid gap-3">
            <Fact label="First guardian" value={[user.guardianName, user.guardianPhone].filter(Boolean).join(" · ") || null} />
            <Fact label="First guardian email" value={user.guardianEmail} />
            <Fact label="Second guardian" value={[user.secondGuardianName, user.secondGuardianPhone].filter(Boolean).join(" · ") || null} />
            <Fact label="Second guardian email" value={user.secondGuardianEmail} />
          </dl>
        </div>
        <div>
          <h3 className="font-medium">Consent</h3>
          <dl className="mt-2 grid gap-3">
            <Fact label="Photos" value={user.consentPhoto ? "On file" : "Missing"} />
            <Fact label="Participation" value={user.consentParticipation ? "On file" : "Missing"} />
            <Fact label="Data handling" value={user.consentData ? "On file" : "Missing"} />
          </dl>
          <p className="mt-4">
            <Link href={`/members/${user.id}`} className="text-sm font-medium underline">Public directory card</Link>
          </p>
        </div>
      </div>
    </Card>
  );
}

function MembershipHistory({ user, open, onOpenChange }: { user: MemberDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const rows = user.memberships;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-left font-serif text-2xl"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
        >
          <ChevronDown className={`h-5 w-5 transition ${open ? "rotate-180" : ""}`} />
          Membership history
          <span className="font-sans text-sm font-normal text-muted-foreground">{rows.length}</span>
        </button>
        <Button variant="outline" size="sm" disabled={rows.length === 0} onClick={() => downloadHistory(user)}>Download history</Button>
      </div>
      {open && (
        <div className="mt-4 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Club</th>
                <th className="p-3">Status</th>
                <th className="p-3">Fee period</th>
                <th className="p-3">Joined</th>
                <th className="p-3">Period ends</th>
                <th className="p-3">Ended</th>
                <th className="p-3">Transferred</th>
                <th className="p-3">Grade at join</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td className="p-3 text-muted-foreground" colSpan={8}>No club memberships yet.</td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.id || row.clubId} className="border-t">
                  <td className="p-3">
                    <p className="font-medium">{row.clubName}</p>
                    {row.clubCity && <p className="text-xs text-muted-foreground">{row.clubCity}</p>}
                  </td>
                  <td className="p-3"><Badge className={membershipTone[row.status] || ""}>{titleCase(row.status)}</Badge></td>
                  <td className="p-3">{row.feePeriod ? `${titleCase(row.feePeriod)} (${feePeriodPhrase(row.feePeriod)})` : "—"}</td>
                  <td className="p-3">{when(row.joinedAt)}</td>
                  <td className="p-3">{when(row.periodEndsAt)}</td>
                  <td className="p-3">{row.endedAt ? when(row.endedAt) : "—"}</td>
                  <td className="p-3">{row.transferredAt ? when(row.transferredAt) : "—"}</td>
                  <td className="p-3">{gradeLabel(row.gradeAtJoin) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value?.trim() ? value : "Not on file"}</dd>
    </div>
  );
}

function downloadHistory(user: MemberDetail) {
  const header = ["club", "city", "status", "fee_period", "joined", "period_ends", "ended", "transferred", "grade_at_join"];
  const lines = [
    header.join(","),
    ...user.memberships.map((row) => [
      row.clubName,
      row.clubCity || "",
      row.status,
      row.feePeriod || "",
      dateOnly(row.joinedAt),
      dateOnly(row.periodEndsAt),
      dateOnly(row.endedAt),
      dateOnly(row.transferredAt),
      row.gradeAtJoin || "",
    ].map(csvCell).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileSlug(user.name)}-membership-history.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function dateOnly(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function fileSlug(name: string) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "member";
}
