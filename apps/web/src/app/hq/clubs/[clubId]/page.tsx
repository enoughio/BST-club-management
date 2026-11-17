"use client";

import { Copy, Eye, Flag, Info, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MemberRoleBadges } from "@/components/role-badges";
import { Field, PageIntro } from "@/components/shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ApiError, api, fileUrl } from "@/lib/api";
import { money, titleCase, when } from "@/lib/format";
import { TITLES, type Club, type Meeting } from "@/lib/types";

type Health = { activeMembers: number; totalMembers: number; completedMeetings: number; meetingsThisQuarter: number; attendanceRate: number; paidInvoices: number; unpaidInvoices: number; duesCollectedMinor: number; duesOutstandingMinor: number };
type Officer = { id: string; title: string; user: { id: string; name: string; email?: string; avatarUrl?: string | null } };
type RosterRow = { membershipId: string; status: string; joinedAt: string; user: { id: string; name: string; email: string; phone?: string | null }; offices: string[]; lastAttendanceAt: string | null; dues: { status: string; amount: number; paidAt: string | null } | null };
type Note = { id: string; body: string; flag: string | null; createdAt: string; author: { id: string; name: string } | null };
type Tab = "members" | "meetings" | "notes" | "settings";
type Pending =
  | { kind: "billing"; fee: number; quarterly: number | null; interval: number }
  | { kind: "status"; status: string }
  | { kind: "admin"; userId: string; name: string }
  | { kind: "reset" }
  | { kind: "delete" }
  | null;

const statusTone: Record<string, string> = { ACTIVE: "bg-blue-100 text-blue-900", PROVISIONAL: "bg-yellow-100 text-yellow-950", INACTIVE: "bg-red-100 text-red-900" };
const memberTone: Record<string, string> = { ACTIVE: "bg-blue-100 text-blue-900", EXPIRED: "bg-yellow-100 text-yellow-950", LAPSED: "bg-muted text-muted-foreground", REMOVED: "bg-muted text-muted-foreground" };
const meetingTone: Record<string, string> = { DRAFT: "bg-yellow-100 text-yellow-950", FINALIZED: "bg-blue-100 text-blue-900", COMPLETED: "bg-blue-50 text-blue-800", CANCELLED: "bg-red-50 text-red-800" };
const flagTone: Record<string, string> = { REVIEW: "bg-yellow-100 text-yellow-950", RISK: "bg-red-100 text-red-900", SUPPORT: "bg-blue-100 text-blue-900", INFO: "bg-muted text-muted-foreground" };
const PAGE = 10;

type ProfileDraft = { name: string; city: string; address: string; meetingSchedule: string; description: string };

const emptyProfile: ProfileDraft = { name: "", city: "", address: "", meetingSchedule: "", description: "" };

function profileFromClub(club: Club): ProfileDraft {
  return {
    name: club.name,
    city: club.city,
    address: club.address ?? "",
    meetingSchedule: club.meetingSchedule ?? "",
    description: club.description ?? "",
  };
}

function isProfileDirty(draft: ProfileDraft, club: Club) {
  const saved = profileFromClub(club);
  return (Object.keys(saved) as (keyof ProfileDraft)[]).some((key) => draft[key] !== saved[key]);
}

function quarterlyMinor(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount)) return undefined;
  return Math.round(amount * 100);
}

function isFeeDirty(fee: string, quarterly: string, interval: string, club: Club) {
  const amountMinor = Math.round(Number(fee) * 100);
  const months = Number(interval);
  const nextQuarterly = quarterlyMinor(quarterly);
  if (!Number.isFinite(amountMinor) || !Number.isFinite(months) || nextQuarterly === undefined) return false;
  return amountMinor !== club.membershipFeeAmount || months !== club.electionIntervalMonths || nextQuarterly !== (club.quarterlyFeeAmount ?? null);
}

export default function HqClubPage() {
  const clubId = String(useParams().clubId);
  const router = useRouter();
  const [club, setClub] = useState<Club | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tab, setTab] = useState<Tab>("members");
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [fee, setFee] = useState("");
  const [quarterly, setQuarterly] = useState("");
  const [interval, setInterval] = useState("");
  const [profile, setProfile] = useState<ProfileDraft>(emptyProfile);
  const [status, setStatus] = useState("");
  const [adminId, setAdminId] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteFlag, setNoteFlag] = useState("INFO");
  const [focusEdit, setFocusEdit] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  function load() {
    api<{ club: Club }>(`/clubs/${clubId}`).then((data) => {
      setClub(data.club);
      setProfile(profileFromClub(data.club));
      setFee(String(data.club.membershipFeeAmount / 100));
      setQuarterly(data.club.quarterlyFeeAmount == null ? "" : String(data.club.quarterlyFeeAmount / 100));
      setInterval(String(data.club.electionIntervalMonths));
      setStatus(data.club.status);
      setAdminId(data.club.currentAdmin?.id || "");
    }).catch(() => undefined);
    api<Health>(`/reports/clubs/${clubId}/health`).then(setHealth).catch(() => undefined);
    api<{ officers: Officer[] }>(`/clubs/${clubId}/officers?scope=current`).then((data) => setOfficers(data.officers)).catch(() => undefined);
    api<{ members: RosterRow[] }>(`/clubs/${clubId}/roster`).then((data) => setRoster(data.members)).catch(() => undefined);
    api<{ meetings: Meeting[] }>(`/clubs/${clubId}/meetings?scope=all`).then((data) => setMeetings(data.meetings)).catch(() => undefined);
    api<{ notes: Note[] }>(`/clubs/${clubId}/notes`).then((data) => setNotes(data.notes)).catch(() => undefined);
  }
  useEffect(load, [clubId]);

  useEffect(() => {
    if (!focusEdit || tab !== "settings") return;
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFocusEdit(false);
  }, [focusEdit, tab]);

  const pageRows = useMemo(() => roster.slice(page * PAGE, page * PAGE + PAGE), [page, roster]);
  const upcoming = meetings.filter((meeting) => ["DRAFT", "FINALIZED"].includes(meeting.status) && new Date(meeting.meetingDate).getTime() >= Date.now() - 86400000);
  const past = meetings.filter((meeting) => !upcoming.includes(meeting));

  if (!club) return <p className="text-muted-foreground">Loading…</p>;

  async function confirmPending() {
    if (!pending || !club) return;
    setBusy(true);
    try {
      if (pending.kind === "billing") {
        await api(`/clubs/${clubId}/billing`, { method: "PATCH", body: JSON.stringify({ membershipFeeAmount: pending.fee, quarterlyFeeAmount: pending.quarterly, electionIntervalMonths: pending.interval }) });
        toast.success("Fee and election cycle saved");
        setClub((current) => current ? { ...current, membershipFeeAmount: pending.fee, quarterlyFeeAmount: pending.quarterly, electionIntervalMonths: pending.interval } : current);
      } else if (pending.kind === "status") {
        await api(`/clubs/${clubId}`, { method: "PATCH", body: JSON.stringify({ status: pending.status }) });
        toast.success(pending.status === "INACTIVE" ? "Club paused" : club.status === "INACTIVE" && pending.status === "ACTIVE" ? "Club reactivated" : "Club status updated");
      } else if (pending.kind === "admin") {
        await api(`/clubs/${clubId}/admin`, { method: "POST", body: JSON.stringify({ userId: pending.userId }) });
        toast.success(`${pending.name} is now the Club Admin`);
      } else if (pending.kind === "reset") {
        const result = await api<{ sent: boolean; email: string }>(`/clubs/${clubId}/admin/reset-password`, { method: "POST", body: "{}" });
        toast.success(result.sent ? `Reset link emailed to ${result.email}` : `Reset link created for ${result.email} (email not configured)`);
      } else if (pending.kind === "delete") {
        await api(`/clubs/${clubId}`, { method: "DELETE" });
        toast.success("Club deleted");
        router.push("/hq/clubs");
        return;
      }
      setPending(null);
      load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const profileChanged = isProfileDirty(profile, club);
  const feeChanged = isFeeDirty(fee, quarterly, interval, club);
  const nextQuarterly = quarterlyMinor(quarterly);
  const feeReady = feeChanged && Number(fee) > 0 && Number(interval) >= 1 && nextQuarterly !== undefined && (nextQuarterly === null || nextQuarterly > 0);

  function requestFeeSave() {
    if (!feeReady || nextQuarterly === undefined) return;
    setPending({ kind: "billing", fee: Math.round(Number(fee) * 100), quarterly: nextQuarterly, interval: Number(interval) });
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileChanged) return;
    try {
      const body = { name: profile.name, city: profile.city, address: profile.address, meetingSchedule: profile.meetingSchedule, description: profile.description };
      await api(`/clubs/${clubId}`, { method: "PATCH", body: JSON.stringify(body) });
      toast.success("Profile saved");
      setClub((current) => current ? { ...current, ...body } : current);
      load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save");
    }
  }

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api(`/clubs/${clubId}/notes`, { method: "POST", body: JSON.stringify({ body: noteBody, flag: noteFlag }) });
      setNoteBody("");
      toast.success("Note saved");
      api<{ notes: Note[] }>(`/clubs/${clubId}/notes`).then((data) => setNotes(data.notes)).catch(() => undefined);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save the note");
    }
  }

  const pendingCopy = describePending(pending, club);
  const activeMembers = roster.filter((row) => row.status === "ACTIVE");
  const latestFlag = notes.find((note) => note.flag && note.flag !== "INFO");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/hq/clubs" className="text-sm text-primary">← All clubs</Link>
        <PageIntro title={club.name} lede={`${club.city} · Chartered ${when(club.charterDate)}`} />
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={statusTone[club.status] || ""}>{titleCase(club.status)}</Badge>
          {latestFlag && <Badge className={flagTone[latestFlag.flag || "INFO"]}><Flag className="mr-1 h-3 w-3" />{titleCase(latestFlag.flag || "")}: {latestFlag.body.slice(0, 60)}{latestFlag.body.length > 60 ? "…" : ""}</Badge>}
        </div>
      </div>

      <div className="sticky top-16 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur md:top-0 md:mx-0 md:rounded-xl md:border md:px-3">
        <Button size="sm" variant="outline" asChild title="Open the club dashboard exactly as the Club Admin sees it"><Link href={`/club/${clubId}`}><Eye className="h-4 w-4" /> View as Club Admin</Link></Button>
        <Button size="sm" onClick={() => { setTab("settings"); setFocusEdit(true); }}>Edit club</Button>
        {club.status === "INACTIVE"
          ? <Button size="sm" variant="outline" onClick={() => setPending({ kind: "status", status: "ACTIVE" })}>Reactivate</Button>
          : <Button size="sm" variant="destructive" onClick={() => setPending({ kind: "status", status: "INACTIVE" })}>Suspend</Button>}
        <Button size="sm" variant="outline" disabled={!club.currentAdmin} onClick={() => setPending({ kind: "reset" })}>Reset admin password</Button>
        <Button size="sm" variant="outline" asChild><a href={fileUrl(`/api/v1/clubs/${clubId}/members/export`)}>Export CSV</a></Button>
        <Button size="sm" variant="destructive" onClick={() => setPending({ kind: "delete" })}>Delete club</Button>
        {tab === "settings" && (
          <>
            <Button size="sm" type="submit" form="club-profile" disabled={!profileChanged}>Save profile</Button>
            <Button size="sm" type="button" variant="outline" disabled={!feeReady} onClick={requestFeeSave}>Save fee</Button>
            <Button size="sm" type="button" variant="outline" disabled={!adminId || adminId === club.currentAdmin?.id} onClick={() => setPending({ kind: "admin", userId: adminId, name: activeMembers.find((row) => row.user.id === adminId)?.user.name || "This member" })}>Appoint admin</Button>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total members" value={health ? String(health.totalMembers) : "—"} hint="Everyone who has ever held a membership here." />
        <Stat label="Active members" value={health ? String(health.activeMembers) : "—"} hint="Memberships in good standing right now." />
        <Stat label="Meetings this quarter" value={health ? String(health.meetingsThisQuarter) : "—"} hint={`Completed since the start of the quarter. ${health?.completedMeetings ?? 0} all time.`} />
        <Stat label="Average attendance" value={health ? `${Math.round(health.attendanceRate * 100)}%` : "—"} hint="Share of attendance records marked present at completed meetings." />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4" title="Set by headquarters. The club cannot change this from its side.">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">Club fee <Info className="h-3.5 w-3.5" /></p>
          <p className="font-serif text-3xl">{money(club.membershipFeeAmount, club.currency)}</p>
          <p className="text-sm">per year</p>
          <p className="text-xs text-muted-foreground">{club.quarterlyFeeAmount == null ? "Annual membership only." : `${money(club.quarterlyFeeAmount, club.currency)} per quarter.`} Charged on every new or reinstated membership.</p>
        </Card>
        <Card className="p-4" title="Set by headquarters. The club cannot change this from its side.">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">Next election <Info className="h-3.5 w-3.5" /></p>
          <p className="font-serif text-3xl">{when(club.nextElectionAt)}</p>
          <p className="text-xs text-muted-foreground">Every {club.electionIntervalMonths} months · 7-day nominations, then 7-day voting.</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Dues</p>
          <p className="font-serif text-3xl">{health ? money(health.duesCollectedMinor, club.currency) : "—"}</p>
          <p className={`text-xs ${health && health.unpaidInvoices > 0 ? "text-red-700" : "text-muted-foreground"}`}>{health && health.unpaidInvoices > 0 ? `${health.unpaidInvoices} unpaid · ${money(health.duesOutstandingMinor, club.currency)} outstanding` : "No outstanding invoices"}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-serif text-xl">Leadership</h2>
            <p className="text-sm text-muted-foreground">Current committee from the officer records. Portal access (Club Admin) is separate from these seats.</p>
          </div>
          <Link href={`/hq/clubs/${clubId}/committee`} className="text-sm text-primary">History</Link>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {TITLES.map((title) => {
            const officer = officers.find((row) => row.title === title);
            return (
              <div key={title} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{titleCase(title)}</p>
                  <p className="truncate text-sm font-medium">{officer?.user.name || <span className="text-muted-foreground">Vacant</span>}</p>
                </div>
                <Avatar name={officer?.user.name} src={officer?.user.avatarUrl} size="sm" />
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed p-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Club Admin (portal)</p>
              <p className="truncate text-sm font-medium">{club.currentAdmin?.name || <span className="text-yellow-800">Not appointed</span>}</p>
              {club.currentAdmin && <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => { void navigator.clipboard.writeText(club.currentAdmin!.email); toast.success("Email copied"); }}><Copy className="h-3 w-3" /> Copy email</button>}
            </div>
            <Avatar name={club.currentAdmin?.name} size="sm" />
          </div>
        </div>
      </Card>

      <div ref={editorRef} className="scroll-mt-36 md:scroll-mt-24">
        <div className="flex gap-1 border-b">
          {([["members", `Members (${roster.length})`], ["meetings", `Meetings (${meetings.length})`], ["notes", `HQ notes (${notes.length})`], ["settings", "Settings"]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} type="button" className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === id ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`} onClick={() => { setTab(id); if (id === "settings") setFocusEdit(true); }}>{label}</button>
          ))}
        </div>

        {tab === "members" && (
          <div className="mt-4">
            <div className="flex flex-col gap-3 md:hidden">
              {pageRows.length === 0 && <p className="text-sm text-muted-foreground">No members yet.</p>}
              {pageRows.map((row) => (
                <Card key={row.membershipId} className="p-4">
                  <Link href={`/hq/members/${row.user.id}`} className="font-medium hover:underline">{row.user.name}</Link>
                  <MemberRoleBadges offices={row.offices} isClubAdmin={club.currentAdmin?.id === row.user.id} />
                  {!row.offices.length && club.currentAdmin?.id !== row.user.id && <p className="mt-1 text-xs text-muted-foreground">Member</p>}
                  <p className="truncate text-sm text-muted-foreground">{row.user.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <Badge className={memberTone[row.status] || ""}>{row.status === "EXPIRED" ? "Probationary" : row.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
                    <span className="text-muted-foreground">{row.lastAttendanceAt ? `Last attendance ${when(row.lastAttendanceAt)}` : "No attendance"}</span>
                    <span>{row.dues ? <span className={row.dues.status === "PAID" ? "text-blue-800" : row.dues.status === "UNPAID" ? "text-red-700" : "text-muted-foreground"}>{titleCase(row.dues.status)} · {money(row.dues.amount, club.currency)}</span> : <span className="text-muted-foreground">No invoice</span>}</span>
                    <span className="text-muted-foreground">Joined {when(row.joinedAt)}</span>
                  </div>
                </Card>
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="p-3">Name</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Last attendance</th><th className="p-3">Dues</th><th className="p-3">Joined</th></tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={6}>No members yet.</td></tr>}
                  {pageRows.map((row) => (
                    <tr key={row.membershipId} className="border-t">
                      <td className="p-3"><Link href={`/hq/members/${row.user.id}`} className="font-medium hover:underline">{row.user.name}</Link><p className="max-w-[16rem] truncate text-xs text-muted-foreground">{row.user.email}</p></td>
                      <td className="p-3">
                        <MemberRoleBadges offices={row.offices} isClubAdmin={club.currentAdmin?.id === row.user.id} className="flex flex-wrap gap-1" />
                        {!row.offices.length && club.currentAdmin?.id !== row.user.id && <span className="text-muted-foreground">Member</span>}
                      </td>
                      <td className="p-3"><Badge className={memberTone[row.status] || ""}>{row.status === "EXPIRED" ? "Probationary" : row.status === "ACTIVE" ? "Active" : "Inactive"}</Badge></td>
                      <td className="p-3">{row.lastAttendanceAt ? when(row.lastAttendanceAt) : <span className="text-muted-foreground">Never</span>}</td>
                      <td className="p-3">{row.dues ? <span className={row.dues.status === "PAID" ? "text-blue-800" : row.dues.status === "UNPAID" ? "text-red-700" : "text-muted-foreground"}>{titleCase(row.dues.status)} · {money(row.dues.amount, club.currency)}</span> : <span className="text-muted-foreground">No invoice</span>}</td>
                      <td className="p-3 text-muted-foreground">{when(row.joinedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {roster.length > PAGE && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Showing {page * PAGE + 1}–{Math.min((page + 1) * PAGE, roster.length)} of {roster.length}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={(page + 1) * PAGE >= roster.length} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "meetings" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section>
              <h3 className="mb-2 font-serif text-xl">Upcoming and drafts</h3>
              <div className="flex flex-col gap-2">
                {upcoming.length === 0 && <Card className="p-3 text-sm text-muted-foreground">Nothing scheduled.</Card>}
                {upcoming.map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} />)}
              </div>
            </section>
            <section>
              <h3 className="mb-2 font-serif text-xl">History</h3>
              <div className="flex flex-col gap-2">
                {past.length === 0 && <Card className="p-3 text-sm text-muted-foreground">No past meetings recorded.</Card>}
                {past.map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} />)}
              </div>
            </section>
          </div>
        )}

        {tab === "notes" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex flex-col gap-2">
              {notes.length === 0 && <Card className="p-4 text-sm text-muted-foreground">No internal notes yet. Use these for context like “under review for low attendance”. Club members and the Club Admin never see them.</Card>}
              {notes.map((note) => (
                <Card key={note.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {note.flag && <Badge className={flagTone[note.flag] || ""}>{titleCase(note.flag)}</Badge>}
                      <span>{note.author?.name || "HQ"} · {new Date(note.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Delete note" onClick={() => api(`/clubs/${clubId}/notes/${note.id}`, { method: "DELETE" }).then(() => setNotes(notes.filter((row) => row.id !== note.id))).catch(() => toast.error("Could not delete"))}><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{note.body}</p>
                </Card>
              ))}
            </div>
            <form className="flex h-fit flex-col gap-3 rounded-xl border bg-card p-4" onSubmit={addNote}>
              <h3 className="font-serif text-xl">Add a note</h3>
              <p className="text-xs text-muted-foreground">Internal to headquarters. Flags show on the club header so the next person sees them.</p>
              <Field label="Flag">
                <Select value={noteFlag} onChange={(event) => setNoteFlag(event.target.value)}>
                  <option value="INFO">Info</option>
                  <option value="REVIEW">Under review</option>
                  <option value="SUPPORT">Needs support</option>
                  <option value="RISK">At risk</option>
                </Select>
              </Field>
              <Field label="Note"><Textarea value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="What should HQ remember about this club?" required /></Field>
              <Button type="submit" disabled={noteBody.trim().length < 2}>Save note</Button>
            </form>
          </div>
        )}

        {tab === "settings" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h3 className="font-serif text-xl">Fee and election cycle</h3>
              <p className="text-xs text-muted-foreground">Affects billing and governance. Every change is confirmed and written to the audit log.</p>
              <div className="mt-3 flex flex-col gap-3">
                <Field label="Annual fee (rupees, per year)"><Input value={fee} inputMode="decimal" onChange={(event) => setFee(event.target.value)} required /></Field>
                <Field label="Quarterly fee (rupees, per quarter)"><Input value={quarterly} inputMode="decimal" placeholder="Leave empty for annual only" onChange={(event) => setQuarterly(event.target.value)} /></Field>
                <Field label="Election interval (months)"><Input value={interval} inputMode="numeric" onChange={(event) => setInterval(event.target.value)} /></Field>
                <Button type="button" disabled={!feeReady} onClick={requestFeeSave}>Review change</Button>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="font-serif text-xl">Club status</h3>
              <p className="text-xs text-muted-foreground">Inactive clubs are shown as paused across headquarters.</p>
              <div className="mt-3 flex flex-col gap-3">
                <Field label="Status">
                  <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="ACTIVE">Active</option>
                    <option value="PROVISIONAL">Provisional</option>
                    <option value="INACTIVE">Inactive (paused)</option>
                  </Select>
                </Field>
                <Button type="button" disabled={status === club.status} onClick={() => setPending({ kind: "status", status })}>Review change</Button>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="font-serif text-xl">Club Admin</h3>
              <p className="text-xs text-muted-foreground">One admin per club. Appointing someone new ends the current appointment.</p>
              <div className="mt-3 flex flex-col gap-3">
                <Field label="Active member">
                  <Select value={adminId} onChange={(event) => setAdminId(event.target.value)}>
                    <option value="">Choose an active member</option>
                    {activeMembers.map((row) => <option key={row.user.id} value={row.user.id}>{row.user.name}{row.offices.length ? ` · ${row.offices.map((title) => titleCase(title)).join(", ")}` : ""}</option>)}
                  </Select>
                </Field>
                <Button type="button" disabled={!adminId || adminId === club.currentAdmin?.id} onClick={() => setPending({ kind: "admin", userId: adminId, name: activeMembers.find((row) => row.user.id === adminId)?.user.name || "This member" })}>Review change</Button>
              </div>
            </Card>
            <form id="club-profile" className="flex flex-col gap-3 rounded-xl border bg-card p-4" onSubmit={saveProfile}>
              <h3 className="font-serif text-xl">Profile</h3>
              <Field label="Name"><Input name="name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></Field>
              <Field label="City"><Input name="city" value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })} /></Field>
              <Field label="Address"><Input name="address" value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} /></Field>
              <Field label="Meeting schedule"><Input name="meetingSchedule" value={profile.meetingSchedule} onChange={(event) => setProfile({ ...profile, meetingSchedule: event.target.value })} /></Field>
              <Field label="Description"><Textarea name="description" value={profile.description} onChange={(event) => setProfile({ ...profile, description: event.target.value })} /></Field>
              <Button type="submit" variant="outline" disabled={!profileChanged}>Save profile</Button>
            </form>
            <Card className="border-red-200 p-4 lg:col-span-2">
              <h3 className="font-serif text-xl text-destructive">Delete club</h3>
              <p className="text-xs text-muted-foreground">Removes the club, its memberships, meetings, and invoices. Member accounts remain.</p>
              <Button className="mt-3" variant="destructive" onClick={() => setPending({ kind: "delete" })}>Delete club</Button>
            </Card>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(next) => { if (!next) setPending(null); }}
        pending={busy}
        destructive={pending?.kind === "delete" || (pending?.kind === "status" && pending.status === "INACTIVE")}
        title={pendingCopy.title}
        description={pendingCopy.description}
        confirmLabel={pendingCopy.confirm}
        onConfirm={() => void confirmPending()}
      />
    </div>
  );
}

function describePending(pending: Pending, club: Club) {
  if (!pending) return { title: "", description: "", confirm: "" };
  if (pending.kind === "billing") {
    const fromQuarterly = club.quarterlyFeeAmount == null ? "annual only" : `${money(club.quarterlyFeeAmount, club.currency)} per quarter`;
    const toQuarterly = pending.quarterly == null ? "annual only" : `${money(pending.quarterly, club.currency)} per quarter`;
    return { title: "Change fee and election cycle?", description: `Annual fee ${money(club.membershipFeeAmount, club.currency)} per year → ${money(pending.fee, club.currency)} per year; quarterly ${fromQuarterly} → ${toQuarterly}; election every ${club.electionIntervalMonths} → ${pending.interval} months. The next election date is recalculated. Recorded in the audit log.`, confirm: "Save" };
  }
  if (pending.kind === "status" && pending.status === "INACTIVE") return { title: `Suspend ${club.name}?`, description: "The club is marked Inactive and shown as paused. Members keep their accounts; nobody is emailed. This change is recorded in the audit log.", confirm: "Suspend" };
  if (pending.kind === "status" && pending.status === "ACTIVE" && club.status === "INACTIVE") return { title: `Reactivate ${club.name}?`, description: "The club returns to Active status. This change is recorded in the audit log.", confirm: "Reactivate" };
  if (pending.kind === "status") return { title: `Mark ${club.name} as ${titleCase(pending.status)}?`, description: "Recorded in the audit log.", confirm: "Change status" };
  if (pending.kind === "admin") return { title: `Appoint ${pending.name} as Club Admin?`, description: `${club.currentAdmin ? `${club.currentAdmin.name}'s appointment ends immediately. ` : ""}${pending.name} gets the club dashboard. Recorded in the audit log.`, confirm: "Appoint" };
  if (pending.kind === "reset") return { title: `Reset the Club Admin password for ${club.name}?`, description: `${club.currentAdmin?.name || "The admin"} receives a one-hour reset link at ${club.currentAdmin?.email || "their email"}. Their current password keeps working until they use it.`, confirm: "Send reset link" };
  return { title: `Delete ${club.name}?`, description: "This cannot be undone. Memberships, meetings, dues, and announcements for this club are removed. Recorded in the audit log.", confirm: "Delete club" };
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-4" title={hint}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-serif text-3xl">{value}</p>
    </Card>
  );
}

function MeetingRow({ meeting }: { meeting: Meeting }) {
  const present = (meeting.attendance || []).filter((row) => row.present).length;
  return (
    <Card className="flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{meeting.title}</p>
        <p className="text-xs text-muted-foreground">{when(meeting.meetingDate)} · {meeting.startTime}–{meeting.endTime}{meeting.status === "COMPLETED" ? ` · ${present} present` : ""}</p>
      </div>
      <Badge className={meetingTone[meeting.status] || ""}>{titleCase(meeting.status)}</Badge>
    </Card>
  );
}
