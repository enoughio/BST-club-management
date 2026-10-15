"use client";

import { CalendarDays, Copy, IndianRupee, MoreHorizontal, PauseCircle, Users, Vote } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { ApiError, api, fileUrl } from "@/lib/api";
import { money, titleCase, when } from "@/lib/format";
import type { Club } from "@/lib/types";

const emptyForm = { name: "", city: "", meetingSchedule: "", charterDate: "", membershipFeeAmount: "1500", electionIntervalMonths: "6", currency: "INR", status: "ACTIVE" };

type Filter = "ALL" | "ACTIVE" | "INACTIVE" | "PROVISIONAL";
type Sort = "name" | "members" | "activity";
type Action = { kind: "suspend" | "reactivate" | "reset"; club: Club } | null;

const statusTone: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-900",
  PROVISIONAL: "bg-sky-100 text-sky-900",
  INACTIVE: "bg-amber-100 text-amber-900",
};

export default function HqClubsPage() {
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<Sort>("name");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api<{ clubs: Club[] }>("/clubs").then((data) => setClubs(data.clubs)).catch(() => undefined);
  }
  useEffect(load, []);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuFor]);

  const shown = useMemo(() => {
    const rows = clubs.filter((club) => {
      if (filter !== "ALL" && club.status !== filter) return false;
      if (!query) return true;
      const hay = `${club.name} ${club.city} ${club.currentAdmin?.name || ""}`.toLowerCase();
      return hay.includes(query.toLowerCase());
    });
    return rows.sort((a, b) => {
      if (sort === "members") return (b.stats?.activeMembers || 0) - (a.stats?.activeMembers || 0);
      if (sort === "activity") return new Date(b.stats?.lastMeetingAt || 0).getTime() - new Date(a.stats?.lastMeetingAt || 0).getTime();
      return a.name.localeCompare(b.name);
    });
  }, [clubs, filter, query, sort]);

  const counts = { ALL: clubs.length, ACTIVE: clubs.filter((club) => club.status === "ACTIVE").length, INACTIVE: clubs.filter((club) => club.status === "INACTIVE").length, PROVISIONAL: clubs.filter((club) => club.status === "PROVISIONAL").length };

  async function createClub(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api("/clubs", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          city: form.city,
          meetingSchedule: form.meetingSchedule || null,
          charterDate: form.charterDate,
          status: form.status,
          membershipFeeAmount: Math.round(Number(form.membershipFeeAmount) * 100),
          currency: form.currency,
          electionIntervalMonths: Number(form.electionIntervalMonths),
        }),
      });
      toast.success("Club created");
      setForm(emptyForm);
      setOpen(false);
      load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not create club");
    }
  }

  async function runAction() {
    if (!action) return;
    setBusy(true);
    try {
      if (action.kind === "suspend" || action.kind === "reactivate") {
        await api(`/clubs/${action.club.id}`, { method: "PATCH", body: JSON.stringify({ status: action.kind === "suspend" ? "INACTIVE" : "ACTIVE" }) });
        toast.success(action.kind === "suspend" ? "Club paused" : "Club reactivated");
      } else {
        const result = await api<{ sent: boolean; email: string }>(`/clubs/${action.club.id}/admin/reset-password`, { method: "POST", body: "{}" });
        toast.success(result.sent ? `Reset link emailed to ${result.email}` : `Reset link created for ${result.email} (email not configured)`);
      }
      setAction(null);
      load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  function copy(value: string) {
    void navigator.clipboard.writeText(value);
    toast.success("Email copied");
  }

  const paused = clubs.filter((club) => club.status === "INACTIVE");

  return (
    <div>
      <PageIntro title="Clubs" lede={`${clubs.length} club${clubs.length === 1 ? "" : "s"} · each has one current Club Admin.`} actions={<Button onClick={() => setOpen(true)}>Add club</Button>} />

      {paused.length > 0 && filter !== "INACTIVE" && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{paused.length === 1 ? `${paused[0].name} is paused and not running meetings.` : `${paused.length} clubs are paused and not running meetings.`} <button type="button" className="underline" onClick={() => setFilter("INACTIVE")}>Show paused clubs</button></p>
        </div>
      )}

      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["ALL", "ACTIVE", "PROVISIONAL", "INACTIVE"] as Filter[]).map((value) => (
            <button key={value} type="button" className={`rounded-full border px-3 py-1 text-sm ${filter === value ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => setFilter(value)}>
              {value === "ALL" ? "All" : value === "INACTIVE" ? "Inactive" : titleCase(value)} <span className="text-xs opacity-70">{counts[value]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input className="sm:w-64" placeholder="Search club, city, or admin" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Select className="sm:w-48" value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Sort clubs">
            <option value="name">Sort: Name</option>
            <option value="members">Sort: Member count</option>
            <option value="activity">Sort: Last activity</option>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {shown.length === 0 && <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">No clubs match this filter.</p>}
        {shown.map((club) => {
          const inactive = club.status === "INACTIVE";
          const stats = club.stats;
          return (
            <div key={club.id} role="link" tabIndex={0} onClick={() => router.push(`/hq/clubs/${club.id}`)} onKeyDown={(event) => { if (event.key === "Enter") router.push(`/hq/clubs/${club.id}`); }} className={`group relative cursor-pointer rounded-xl border p-4 transition hover:border-primary hover:shadow-sm ${inactive ? "border-amber-300 bg-amber-50/60" : "bg-card"}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-serif text-xl">{club.name}</p>
                    <Badge className={statusTone[club.status] || ""}>{titleCase(club.status)}</Badge>
                    {inactive && <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800"><PauseCircle className="h-3.5 w-3.5" /> Paused</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{club.city}</p>
                  <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                    <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">Meeting schedule</dt><dd>{club.meetingSchedule || "Not set"}</dd></div></div>
                    <div className="flex items-start gap-2"><Vote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">Election cycle</dt><dd>Every {club.electionIntervalMonths} months · next {when(club.nextElectionAt)}</dd></div></div>
                    <div className="flex items-start gap-2"><IndianRupee className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">Fee</dt><dd>{money(club.membershipFeeAmount, club.currency)}</dd></div></div>
                  </dl>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Club Admin:</span>
                    {club.currentAdmin ? (
                      <>
                        <span className="font-medium">{club.currentAdmin.name}</span>
                        <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted" title={`Copy ${club.currentAdmin.email}`} aria-label="Copy admin email" onClick={(event) => { event.stopPropagation(); copy(club.currentAdmin!.email); }}><Copy className="h-3.5 w-3.5" /></button>
                      </>
                    ) : <span className="text-amber-800">Not appointed</span>}
                  </div>
                </div>

                <div className="flex items-start gap-3 lg:w-[22rem] lg:shrink-0">
                  <dl className="grid flex-1 grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/60 p-2"><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Members</dt><dd className="font-serif text-xl">{stats?.totalMembers ?? "—"}</dd><dd className="text-[11px] text-muted-foreground">{stats?.activeMembers ?? 0} active</dd></div>
                    <div className="rounded-lg bg-muted/60 p-2"><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Last meeting</dt><dd className="text-sm font-medium">{stats?.lastMeetingAt ? when(stats.lastMeetingAt) : "None"}</dd></div>
                    <div className={`rounded-lg p-2 ${stats && stats.unpaidCount > 0 ? "bg-red-50" : "bg-muted/60"}`}><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Dues</dt><dd className={`text-sm font-medium ${stats && stats.unpaidCount > 0 ? "text-red-700" : "text-emerald-800"}`}>{stats && stats.unpaidCount > 0 ? `${stats.unpaidCount} unpaid` : "Clear"}</dd>{stats && stats.unpaidCount > 0 && <dd className="text-[11px] text-muted-foreground">{money(stats.unpaidMinor, club.currency)}</dd>}</div>
                  </dl>
                  <div className="relative">
                    <Button variant="outline" size="icon" className="h-9 w-9 opacity-100 lg:opacity-0 lg:transition lg:group-hover:opacity-100 lg:focus:opacity-100" aria-label={`Actions for ${club.name}`} onClick={(event) => { event.stopPropagation(); setMenuFor(menuFor === club.id ? null : club.id); }}><MoreHorizontal className="h-4 w-4" /></Button>
                    {menuFor === club.id && (
                      <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border bg-card p-1 shadow-lg" onClick={(event) => event.stopPropagation()}>
                        <Link href={`/hq/clubs/${club.id}`} className="block rounded-md px-3 py-2 text-sm hover:bg-muted">Open club</Link>
                        <Link href={`/club/${club.id}`} className="block rounded-md px-3 py-2 text-sm hover:bg-muted">View as Club Admin</Link>
                        <a href={fileUrl(`/api/v1/clubs/${club.id}/members/export`)} className="block rounded-md px-3 py-2 text-sm hover:bg-muted">Export member data (CSV)</a>
                        <button type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50" disabled={!club.currentAdmin} onClick={() => { setMenuFor(null); setAction({ kind: "reset", club }); }}>Reset admin password</button>
                        {inactive
                          ? <button type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setMenuFor(null); setAction({ kind: "reactivate", club }); }}>Reactivate club</button>
                          : <button type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-muted" onClick={() => { setMenuFor(null); setAction({ kind: "suspend", club }); }}>Suspend club</button>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(action)}
        onOpenChange={(next) => { if (!next) setAction(null); }}
        pending={busy}
        destructive={action?.kind === "suspend"}
        title={action?.kind === "suspend" ? `Suspend ${action.club.name}?` : action?.kind === "reactivate" ? `Reactivate ${action.club.name}?` : `Reset the Club Admin password for ${action?.club.name}?`}
        description={action?.kind === "suspend" ? "The club is marked Inactive and shown as paused. Members keep their accounts; nobody is emailed. This change is recorded in the audit log." : action?.kind === "reactivate" ? "The club returns to Active status. This change is recorded in the audit log." : `${action?.club.currentAdmin?.name || "The admin"} receives a one-hour reset link at ${action?.club.currentAdmin?.email || "their email"}. Their current password keeps working until they use it.`}
        confirmLabel={action?.kind === "suspend" ? "Suspend" : action?.kind === "reactivate" ? "Reactivate" : "Send reset link"}
        onConfirm={() => void runAction()}
      />

      <Sheet open={open} onOpenChange={setOpen} title="Add club">
        <form className="flex flex-col gap-3" onSubmit={createClub}>
          <Field label="Name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
          <Field label="City"><Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} required /></Field>
          <Field label="Meeting schedule"><Input value={form.meetingSchedule} placeholder="Thursdays, 7:00 PM" onChange={(event) => setForm({ ...form, meetingSchedule: event.target.value })} /></Field>
          <Field label="Charter date"><Input type="date" value={form.charterDate} onChange={(event) => setForm({ ...form, charterDate: event.target.value })} required /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="PROVISIONAL">Provisional</option>
            </Select>
          </Field>
          <Field label="Membership fee (rupees)"><Input value={form.membershipFeeAmount} onChange={(event) => setForm({ ...form, membershipFeeAmount: event.target.value })} required /></Field>
          <Field label="Currency"><Select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option>INR</option></Select></Field>
          <Field label="Election interval (months)"><Input value={form.electionIntervalMonths} onChange={(event) => setForm({ ...form, electionIntervalMonths: event.target.value })} required /></Field>
          <Button type="submit">Create club</Button>
        </form>
      </Sheet>
    </div>
  );
}
