"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { ageOn, gradeLabel, nextBirthday } from "@/lib/child";
import { relativeWhen, when } from "@/lib/format";
import type { MemberRow } from "@/lib/types";

const tone: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-900",
  EXPIRED: "bg-amber-100 text-amber-900",
  LAPSED: "bg-muted text-muted-foreground",
  REMOVED: "bg-muted text-muted-foreground",
};

const label: Record<string, string> = {
  ACTIVE: "Active",
  EXPIRED: "Probationary",
  LAPSED: "Inactive",
  REMOVED: "Inactive",
};

export default function OfficerMembersPage() {
  const clubId = String(useParams().clubId);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState("ALL");
  useEffect(() => { api<{ members: MemberRow[] }>(`/clubs/${clubId}/members`).then((data) => setMembers(data.members)).catch(() => undefined); }, [clubId]);

  const shown = useMemo(() => members.filter((row) => {
    const text = `${row.user.name} ${row.user.email}`.toLowerCase();
    if (query && !text.includes(query.toLowerCase())) return false;
    if (chip === "ACTIVE") return row.status === "ACTIVE";
    if (chip === "INACTIVE") return row.status === "LAPSED" || row.status === "REMOVED";
    if (chip === "PROBATIONARY") return row.status === "EXPIRED";
    return true;
  }), [members, query, chip]);

  return (
    <div>
      <PageIntro title="Members" lede="Read-only roster. Membership changes stay with the Club Admin." />
      <Input className="mb-3" placeholder="Search name or email" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="mb-3 flex flex-wrap gap-2">
        {[["ALL", "All"], ["ACTIVE", "Active"], ["INACTIVE", "Inactive"], ["PROBATIONARY", "Probationary"]].map(([id, name]) => (
          <button key={id} type="button" className={`rounded-full border px-3 py-1 text-sm ${chip === id ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => setChip(id)}>{name}</button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {shown.map((row) => (
          <Link key={row.membershipId} href={`/members/${row.user.id}`} className="flex flex-col gap-1 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <span className="block font-medium">{row.user.name}</span>
              <span className="mt-1 flex flex-wrap gap-1 text-xs">
                {row.user.dateOfBirth && <span className="text-muted-foreground">{ageOn(row.user.dateOfBirth)} years</span>}
                {(row.user.grade || row.user.school) && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-900">{[gradeLabel(row.user.grade), row.user.school].filter(Boolean).join(" · ")}</span>}
                {row.user.dateOfBirth && (() => { const birthday = nextBirthday(row.user.dateOfBirth); return birthday && birthday.days <= 30 ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-900">Birthday {when(birthday.date.toISOString())}</span> : null; })()}
              </span>
              {row.user.guardianName && <span className="block text-xs text-muted-foreground">{row.user.guardianName}{row.user.guardianPhone ? ` · ${row.user.guardianPhone}` : ""}</span>}
            </span>
            <span className="flex items-center gap-2 text-sm">
              <Badge className={tone[row.status] || ""}>{label[row.status] || row.status}</Badge>
              <span className="text-muted-foreground" title={relativeWhen(row.joinedAt)}>{row.user.phone || "—"}</span>
            </span>
          </Link>
        ))}
        {shown.length === 0 && <p className="p-4 text-sm text-muted-foreground">No members match this filter.</p>}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{members.length} members · {members.filter((row) => row.status === "ACTIVE").length} active</p>
    </div>
  );
}
