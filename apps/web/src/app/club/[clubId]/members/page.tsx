"use client";

import { MoreHorizontal } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useBusEvent } from "@/components/dashboard-bus";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { ApiError, api, fileUrl } from "@/lib/api";
import { money, relativeWhen, titleCase, when } from "@/lib/format";
import type { MemberRow } from "@/lib/types";

type Filter = "ALL" | "ACTIVE" | "INACTIVE" | "PROBATIONARY";
type Profile = {
  status: string;
  joinedAt: string;
  user: MemberRow["user"] & { occupation?: string | null; goals?: string | null };
  offices: string[];
  invoices: { id: string; amount: number; currency: string; status: string }[];
  attendance: { id: string; present: boolean; late: boolean; meeting: { title: string; meetingDate: string } }[];
  projects: { title: string; level: string; approved: boolean }[];
};

const tone: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  LAPSED: "bg-stone-200 text-stone-700",
  REMOVED: "bg-stone-200 text-stone-700",
  EXPIRED: "bg-amber-100 text-amber-900",
};

function chip(status: string): Filter {
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "EXPIRED") return "PROBATIONARY";
  return "INACTIVE";
}

export default function ClubMembersPage() {
  const clubId = String(useParams().clubId);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [page, setPage] = useState(0);
  const [menu, setMenu] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  function load() {
    api<{ members: MemberRow[] }>(`/clubs/${clubId}/members`).then((data) => setMembers(data.members)).catch(() => undefined);
  }
  useEffect(load, [clubId]);
  useBusEvent(["members:changed", "club:changed"], load);

  const filtered = useMemo(() => members.filter((row) => {
    const hay = `${row.user.name} ${row.user.email}`.toLowerCase();
    if (query && !hay.includes(query.toLowerCase())) return false;
    if (filter !== "ALL" && chip(row.status) !== filter) return false;
    return true;
  }), [filter, members, query]);
  const activeCount = members.filter((row) => row.status === "ACTIVE").length;
  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, page * pageSize + pageSize);

  function openProfile(userId: string) {
    api<{ member: Profile }>(`/clubs/${clubId}/members/${userId}/profile`).then((data) => setProfile(data.member)).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not open profile"));
  }

  function exportSelected() {
    const rows = members.filter((row) => selected.includes(row.user.id));
    const source = rows.length ? rows : filtered;
    const csv = ["name,email,phone,status,joined", ...source.map((row) => [row.user.name, row.user.email, row.user.phone || "", row.status, row.joinedAt.slice(0, 10)].join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "members.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <PageIntro title="Members" />
          <p className="text-sm text-muted-foreground">{members.length} members · {activeCount} active</p>
        </div>
        <div className="relative">
          <Button variant="outline" size="icon" aria-label="Member actions" onClick={() => setMenu((value) => !value)}><MoreHorizontal className="h-4 w-4" /></Button>
          {menu && (
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border bg-card p-2 shadow-lg">
              <a className="block rounded-md px-3 py-2 text-sm hover:bg-muted" href={fileUrl(`/api/v1/clubs/${clubId}/members/export`)}>Export all</a>
              <button className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted" onClick={exportSelected}>Export selected</button>
              <form className="px-3 py-2" onSubmit={(event) => {
                event.preventDefault();
                const body = new FormData(event.currentTarget);
                api(`/clubs/${clubId}/members/import`, { method: "POST", body }).then(() => { toast.success("Import finished"); setMenu(false); load(); }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Import failed"));
              }}>
                <Input name="file" type="file" accept=".csv,text/csv" required />
                <Button className="mt-2 w-full" type="submit" variant="outline">Import CSV</Button>
              </form>
              <button className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => {
                const ids = selected.length ? selected : members.filter((row) => row.status === "ACTIVE").map((row) => row.user.id);
                api(`/clubs/${clubId}/reminders`, { method: "POST", body: JSON.stringify({ userIds: ids, message: "A reminder from your club admin." }) })
                  .then(() => toast.success("Reminder sent"))
                  .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not send"));
              }}>Send reminder</button>
            </div>
          )}
        </div>
      </div>
      <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search name or email" />
      <div className="mt-3 flex flex-wrap gap-2">
        {(["ALL", "ACTIVE", "INACTIVE", "PROBATIONARY"] as Filter[]).map((value) => (
          <button key={value} type="button" className={`rounded-full border px-3 py-1 text-xs ${filter === value ? "bg-primary text-primary-foreground" : ""}`} onClick={() => { setFilter(value); setPage(0); }}>
            {value === "ALL" ? "All" : value === "ACTIVE" ? "Active" : value === "INACTIVE" ? "Inactive" : "Probationary"}
          </button>
        ))}
      </div>
      <ul className="mt-4 divide-y rounded-xl border bg-card">
        {visible.map((row) => (
          <li key={row.membershipId} className="flex items-center gap-3 px-3 py-3">
            <input type="checkbox" className="h-4 w-4" checked={selected.includes(row.user.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, row.user.id] : selected.filter((id) => id !== row.user.id))} aria-label={`Select ${row.user.name}`} />
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openProfile(row.user.id)}>
              <p className="font-medium">{row.user.name}</p>
              <p className="truncate text-sm text-muted-foreground">{row.user.email}</p>
              <p className="text-sm text-muted-foreground">{row.user.phone?.trim() ? row.user.phone : "—"}</p>
            </button>
            <div className="hidden text-right text-xs text-muted-foreground sm:block" title={relativeWhen(row.joinedAt)}>{when(row.joinedAt)}</div>
            <span className={`rounded-full px-2 py-1 text-[11px] ${tone[row.status] || tone.LAPSED}`}>{row.status === "EXPIRED" ? "Probationary" : row.status === "ACTIVE" ? "Active" : "Inactive"}</span>
            <Button variant="outline" size="sm" onClick={() => openProfile(row.user.id)}>Details</Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span>Page {page + 1} of {pages}</span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>
      <Sheet open={Boolean(profile)} onOpenChange={(open) => { if (!open) setProfile(null); }} title={profile?.user.name || "Member"}>
        {profile && (
          <div className="flex flex-col gap-4 text-sm">
            <p className="truncate">{profile.user.email}</p>
            <p>{profile.user.phone?.trim() ? profile.user.phone : "—"}</p>
            <p title={relativeWhen(profile.joinedAt)}>Joined {when(profile.joinedAt)}</p>
            <section>
              <h3 className="font-serif text-xl">Pathway</h3>
              {profile.projects.length === 0 && <p className="text-muted-foreground">No projects selected yet.</p>}
              {profile.projects.map((project) => <p key={project.title}>{project.level}: {project.title} · {project.approved ? "Approved" : "In progress"}</p>)}
            </section>
            <section>
              <h3 className="font-serif text-xl">Attendance</h3>
              {profile.attendance.map((row) => <p key={row.id}>{row.meeting.title} · {when(row.meeting.meetingDate)} · {row.late ? "Late" : row.present ? "Present" : "Absent"}</p>)}
            </section>
            <section>
              <h3 className="font-serif text-xl">Dues</h3>
              {profile.invoices.length === 0 && <p className="text-muted-foreground">No invoices yet.</p>}
              {profile.invoices.map((invoice) => <p key={invoice.id}>{money(invoice.amount, invoice.currency)} · {titleCase(invoice.status)}</p>)}
            </section>
            <section>
              <h3 className="font-serif text-xl">Roles</h3>
              {profile.offices.length === 0 && <p className="text-muted-foreground">No current officer role.</p>}
              {profile.offices.map((title) => <p key={title}>{titleCase(title)}</p>)}
            </section>
          </div>
        )}
      </Sheet>
    </div>
  );
}
