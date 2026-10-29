"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RangeToggle, useBusEvent, useClubRange } from "@/components/dashboard-bus";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { nextBirthday } from "@/lib/child";
import { titleCase, when } from "@/lib/format";
import { TITLES, type Club, type Meeting, type MemberRow } from "@/lib/types";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Officer = { title: string; user: { id: string; name: string } };
type Focus = "members" | "expiring" | "meetings" | "roles" | null;

export default function ClubHome() {
  const clubId = String(useParams().clubId);
  const { days } = useClubRange();
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [focus, setFocus] = useState<Focus>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [remindOpen, setRemindOpen] = useState(false);
  const [message, setMessage] = useState("Please check the club portal for your next meeting and dues.");
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const apply = () => setNarrow(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  function load() {
    api<{ club: Club; members: MemberRow[] }>(`/clubs/${clubId}`).then((data) => { setClub(data.club); setMembers(data.members); }).catch(() => undefined);
    api<{ meetings: Meeting[] }>(`/clubs/${clubId}/meetings?scope=all`).then((data) => setMeetings(data.meetings)).catch(() => undefined);
    api<{ officers: Officer[] }>(`/clubs/${clubId}/officers?scope=current`).then((data) => setOfficers(data.officers)).catch(() => undefined);
  }
  useEffect(load, [clubId]);
  useBusEvent("*", load);

  const since = Date.now() - days * 86400000;
  const active = members.filter((row) => row.status === "ACTIVE");
  const expiring = active.filter((row) => {
    const joined = new Date(row.joinedAt);
    const next = new Date(joined);
    next.setFullYear(new Date().getFullYear());
    if (next.getTime() < Date.now() - 86400000) next.setFullYear(next.getFullYear() + 1);
    const delta = next.getTime() - Date.now();
    return delta >= 0 && delta <= 15 * 86400000;
  });
  const upcoming = meetings.filter((meeting) => ["DRAFT", "FINALIZED"].includes(meeting.status) && new Date(meeting.meetingDate).getTime() >= Date.now() - 86400000);
  const openRoles = TITLES.filter((title) => !officers.some((officer) => officer.title === title));
  const quiet = active.filter((member) => !meetings.some((meeting) => new Date(meeting.meetingDate).getTime() >= Date.now() - 30 * 86400000 && meeting.attendance?.some((row) => row.userId === member.user.id && row.present)));
  const birthdays = active.flatMap((row) => {
    if (!row.user.dateOfBirth) return [];
    const birthday = nextBirthday(row.user.dateOfBirth);
    if (!birthday || birthday.days > 30) return [];
    return [{ id: row.membershipId, name: row.user.name, days: birthday.days, date: birthday.date.toISOString() }];
  }).sort((a, b) => a.days - b.days);
  const consentGaps = active.filter((row) => row.user.consentPhoto === false || row.user.consentParticipation === false || row.user.consentData === false);

  const attendance = useMemo(() => meetings
    .filter((meeting) => meeting.status === "COMPLETED" && new Date(meeting.meetingDate).getTime() >= since)
    .map((meeting) => {
      const rows = meeting.attendance || [];
      const present = rows.filter((row) => row.present).length;
      return { label: when(meeting.meetingDate), title: meeting.title, present, absent: Math.max(active.length - present, 0), rate: active.length ? Math.round((present / active.length) * 100) : 0 };
    }), [active.length, meetings, since]);

  const growth = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const member of members) {
      const joined = new Date(member.joinedAt).getTime();
      if (joined < since) continue;
      const key = new Date(member.joinedAt).toLocaleDateString("en-IN", { month: "short" });
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    return [...buckets.entries()].map(([month, joined]) => ({ month, joined, active: active.length, inactive: members.length - active.length }));
  }, [active.length, members, since]);

  function downloadReport() {
    api<Blob>(`/reports/clubs/${clubId}/health.pdf`).then((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${club?.slug || "club"}-report.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not generate the report"));
  }

  return (
    <div>
      <PageIntro title="Overview" lede={club?.name || "Club"} actions={<RangeToggle />} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total members" value={members.length} hint="Everyone on the club roll" active={focus === "members"} onClick={() => setFocus(focus === "members" ? null : "members")} />
        <Stat label="Expiring soon" value={expiring.length} hint="Anniversary falls in the next 15 days" active={focus === "expiring"} onClick={() => setFocus(focus === "expiring" ? null : "expiring")} />
        <Stat label="Upcoming meetings" value={upcoming.length} hint="Drafts and finalized meetings still ahead" active={focus === "meetings"} onClick={() => setFocus(focus === "meetings" ? null : "meetings")} />
        <Stat label="Open roles" value={openRoles.length} hint="Officer seats with nobody assigned" active={focus === "roles"} onClick={() => setFocus(focus === "roles" ? null : "roles")} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Button asChild><Link href={`/club/${clubId}/meetings`}>Schedule a meeting</Link></Button>
        <Button variant="outline" onClick={() => setRemindOpen(true)}>Send member reminder</Button>
        <Button variant="outline" asChild><Link href={`/club/${clubId}/committee`}>Update officer information</Link></Button>
        <Button variant="outline" onClick={downloadReport}>Generate club report</Button>
      </div>

      {focus === "members" && <FilterList title="Members" rows={members.map((row) => row.user.name)} />}
      {focus === "expiring" && <FilterList title="Memberships expiring soon" rows={expiring.map((row) => `${row.user.name} · anniversary ${when(row.joinedAt)}`)} empty="No memberships renew in the next 15 days." />}
      {focus === "meetings" && <FilterList title="Upcoming meetings" rows={upcoming.map((meeting) => `${meeting.title} · ${when(meeting.meetingDate)}`)} empty="No upcoming meetings." />}
      {focus === "roles" && <FilterList title="Open roles" rows={openRoles.map((title) => titleCase(title))} empty="Every officer seat is filled." />}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-serif text-xl">Birthdays in the next 30 days</h2>
          <p className="mt-1 text-sm text-muted-foreground">Active members whose birthday falls in the next 30 days.</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {birthdays.length === 0 && <li className="text-muted-foreground">No birthdays in the next 30 days.</li>}
            {birthdays.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-900">
                <span className="font-medium">{row.name}</span>
                <span>{row.days === 0 ? "Today" : `${row.days} day${row.days === 1 ? "" : "s"}`} · {when(row.date)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className={`p-4 ${consentGaps.length ? "border-red-300" : ""}`}>
          <h2 className="font-serif text-xl">Consent still missing</h2>
          <p className="mt-1 text-sm text-muted-foreground">Photos, participation, or data-handling consent is not on file.</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {consentGaps.length === 0 && <li className="text-muted-foreground">Every active member has consent on file.</li>}
            {consentGaps.map((row) => {
              const missing = [row.user.consentPhoto === false && "photos", row.user.consentParticipation === false && "participation", row.user.consentData === false && "data handling"].filter(Boolean).join(", ");
              return <li key={row.membershipId} className="text-red-900">{row.user.name} · {missing}</li>;
            })}
          </ul>
          {consentGaps.length > 0 && <Button className="mt-3" variant="outline" asChild><Link href={`/club/${clubId}/members`}>Open the roll</Link></Button>}
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Block title="Attendance trend" open={expanded === "attendance"} onToggle={() => setExpanded(expanded === "attendance" ? null : "attendance")} summary={narrow ? `${attendance.at(-1)?.rate ?? 0}% at the latest completed meeting` : undefined}>
          {!narrow && (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendance}><XAxis dataKey="label" /><YAxis /><Tooltip /><Line dataKey="rate" stroke="#1e3a5f" /></LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {expanded === "attendance" && (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {attendance.length === 0 && <li className="text-muted-foreground">No completed meetings in this range.</li>}
              {attendance.map((row) => <li key={row.label + row.title}>{row.title} · {row.label} · {row.present} present · {row.absent} not marked present · {row.rate}%</li>)}
            </ul>
          )}
        </Block>
        <Block title="Member growth" open={expanded === "growth"} onToggle={() => setExpanded(expanded === "growth" ? null : "growth")} summary={narrow ? `${active.length} active · ${members.length - active.length} inactive` : undefined}>
          {!narrow && (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={growth}><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="joined" stackId="a" fill="#9a3412" /><Bar dataKey="active" stackId="b" fill="#1e3a5f" /></BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {expanded === "growth" && <p className="mt-3 text-sm">{members.filter((row) => new Date(row.joinedAt).getTime() >= since).length} new joins · {active.length} active · {members.length - active.length} inactive</p>}
        </Block>
        <Block title="Role fulfillment" open={expanded === "roles"} onToggle={() => setExpanded(expanded === "roles" ? null : "roles")} summary={narrow ? `${TITLES.length - openRoles.length} of ${TITLES.length} seats filled` : undefined}>
          <div className="flex flex-col gap-2">
            {TITLES.map((title) => {
              const filled = officers.some((officer) => officer.title === title);
              return (
                <div key={title}>
                  <div className="flex justify-between text-xs"><span>{titleCase(title)}</span><span>{filled ? "Filled" : "Vacant"}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: filled ? "100%" : "0%" }} /></div>
                </div>
              );
            })}
          </div>
        </Block>
        <Block title="Member engagement" open={expanded === "quiet"} onToggle={() => setExpanded(expanded === "quiet" ? null : "quiet")} summary={narrow ? `${quiet.length} members missed the last 30 days` : undefined}>
          <p className="text-sm text-muted-foreground">Members with no attendance in the last 30 days.</p>
          {expanded === "quiet" && (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {quiet.length === 0 && <li>Everyone on the active roll has attended recently.</li>}
              {quiet.map((row) => <li key={row.membershipId}>{row.user.name}</li>)}
            </ul>
          )}
        </Block>
      </div>
      <ConfirmDialog open={remindOpen} onOpenChange={setRemindOpen} title="Send member reminder" description="This emails every active member." confirmLabel="Send" onConfirm={() => {
        api(`/clubs/${clubId}/reminders`, { method: "POST", body: JSON.stringify({ userIds: active.map((row) => row.user.id), message }) })
          .then(() => { toast.success("Reminder sent"); setRemindOpen(false); })
          .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not send"));
      }}>
        <Textarea value={message} onChange={(event) => setMessage(event.target.value)} />
      </ConfirmDialog>
    </div>
  );
}

function Stat({ label, value, hint, active, onClick }: { label: string; value: number; hint: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" title={hint} onClick={onClick} className={`rounded-xl border bg-card p-4 text-left ${active ? "ring-2 ring-primary" : ""}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-serif text-3xl">{value}</p>
    </button>
  );
}

function FilterList({ title, rows, empty }: { title: string; rows: string[]; empty?: string }) {
  return (
    <Card className="mt-4 p-4">
      <h2 className="font-serif text-xl">{title}</h2>
      {rows.length === 0 && <p className="mt-2 text-sm text-muted-foreground">{empty || "Nothing in this filter."}</p>}
      <ul className="mt-2 flex flex-col gap-1 text-sm">{rows.map((row) => <li key={row}>{row}</li>)}</ul>
    </Card>
  );
}

function Block({ title, open, onToggle, summary, children }: { title: string; open: boolean; onToggle: () => void; summary?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <button type="button" className="flex w-full items-center justify-between text-left" onClick={onToggle}>
        <span className="font-serif text-xl">{title}</span>
        <span className="text-xs text-muted-foreground">{open ? "Hide numbers" : "Show numbers"}</span>
      </button>
      {summary && <p className="mt-2 text-sm">{summary}</p>}
      <div className="mt-3">{children}</div>
    </Card>
  );
}
