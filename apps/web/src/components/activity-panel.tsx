"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RangeToggle, useBusEvent, useClubRange, useDashboardBus } from "@/components/dashboard-bus";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { when } from "@/lib/format";
import type { Club, Meeting, MemberRow } from "@/lib/types";

type Note = { id: string; title: string; body: string; createdAt: string; recipientCount?: number };
type Alert = { id: string; tone: "critical" | "warning" | "info"; title: string; href: string };

/**
 * Activity and alerts rail. Loads its own data, scrolls on its own, and talks to the
 * other panels only through the dashboard bus: it reads the shared range, publishes the
 * critical alert count for the mobile bell, and reloads when a page announces a change.
 */
export function ActivityPanel({ clubId, publishCount = true }: { clubId: string; publishCount?: boolean }) {
  const router = useRouter();
  const { days } = useClubRange();
  const { setAlertCount, emit } = useDashboardBus();
  const [tab, setTab] = useState<"all" | "alerts" | "notes">("all");
  const [club, setClub] = useState<Club | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [unpaid, setUnpaid] = useState(0);
  const [openNote, setOpenNote] = useState<string | null>(null);

  function load() {
    api<{ club: Club }>(`/clubs/${clubId}`).then((data) => setClub(data.club)).catch(() => undefined);
    api<{ meetings: Meeting[] }>(`/clubs/${clubId}/meetings?scope=all`).then((data) => setMeetings(data.meetings)).catch(() => undefined);
    api<{ members: MemberRow[] }>(`/clubs/${clubId}/members`).then((data) => setMembers(data.members)).catch(() => undefined);
    api<{ announcements: Note[] }>(`/clubs/${clubId}/announcements`).then((data) => setNotes(data.announcements)).catch(() => undefined);
    api<{ unpaidInvoices?: number }>(`/reports/clubs/${clubId}/health`).then((data) => setUnpaid(data.unpaidInvoices || 0)).catch(() => undefined);
  }
  useEffect(load, [clubId]);
  useBusEvent("*", (event) => { if (event !== "announcement:sent") load(); });

  const since = Date.now() - days * 86400000;
  const alerts = useMemo(() => {
    const rows: Alert[] = [];
    if (unpaid > 0) rows.push({ id: "dues", tone: "critical", title: `${unpaid} dues overdue`, href: `/club/${clubId}/members` });
    const drafts = meetings.filter((meeting) => meeting.status === "DRAFT");
    if (drafts.length) rows.push({ id: "drafts", tone: "critical", title: `${drafts.length} meeting${drafts.length === 1 ? "" : "s"} unfinalized`, href: `/club/${clubId}/meetings` });
    if (club?.nextElectionAt && new Date(club.nextElectionAt).getTime() - Date.now() < 30 * 86400000) {
      rows.push({ id: "election", tone: "warning", title: "Election deadline approaching", href: `/club/${clubId}/committee` });
    }
    const joined = members.filter((row) => new Date(row.joinedAt).getTime() >= since).length;
    if (joined) rows.push({ id: "joined", tone: "info", title: `${joined} new member${joined === 1 ? "" : "s"} joined`, href: `/club/${clubId}/members` });
    const rank = { critical: 0, warning: 1, info: 2 };
    return rows.sort((a, b) => rank[a.tone] - rank[b.tone]);
  }, [club, clubId, meetings, members, since, unpaid]);

  const critical = alerts.filter((row) => row.tone === "critical").length;
  useEffect(() => { if (publishCount) setAlertCount(critical); }, [critical, publishCount, setAlertCount]);

  const feed = notes.filter((note) => new Date(note.createdAt).getTime() >= since);
  const toneClass = { critical: "bg-red-600 text-white", warning: "bg-amber-500 text-white", info: "bg-sky-600 text-white" };

  return (
    <div className="flex min-h-full flex-col gap-4 p-4">
      <div>
        <h2 className="font-serif text-2xl">Activity and alerts</h2>
        <RangeToggle className="mt-2" />
        <div className="mt-3 flex flex-wrap gap-2">
          {(["all", "alerts", "notes"] as const).map((value) => (
            <button key={value} type="button" className={`rounded-full border px-3 py-1 text-xs ${tab === value ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setTab(value)}>
              {value === "notes" ? "Announcements" : value === "alerts" ? "Alerts only" : "All"}
            </button>
          ))}
        </div>
      </div>
      {tab !== "notes" && (
        <div className="flex flex-col gap-2">
          {alerts.length === 0 && <p className="text-sm text-muted-foreground">No open alerts in this range.</p>}
          {alerts.map((alert) => (
            <button key={alert.id} type="button" className="rounded-lg border p-3 text-left" onClick={() => router.push(alert.href)}>
              <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${toneClass[alert.tone]}`}>{alert.tone}</span>
              <p className="mt-2 text-sm font-medium">{alert.title}</p>
            </button>
          ))}
        </div>
      )}
      {tab !== "alerts" && (
        <div className="flex flex-col gap-2">
          {feed.length === 0 && <p className="text-sm text-muted-foreground">No announcements in this range.</p>}
          {feed.map((note) => (
            <button key={note.id} type="button" className="rounded-lg border p-3 text-left" onClick={() => setOpenNote(openNote === note.id ? null : note.id)}>
              <p className="font-medium">{note.title}</p>
              <p className="text-xs text-muted-foreground">{when(note.createdAt)} · {note.recipientCount ? `Emailed ${note.recipientCount}` : "In-app notice"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{openNote === note.id ? note.body : `${note.body.slice(0, 80)}${note.body.length > 80 ? "…" : ""}`}</p>
            </button>
          ))}
        </div>
      )}
      <form className="mt-auto flex flex-col gap-2 border-t pt-3" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        api(`/clubs/${clubId}/announcements`, { method: "POST", body: JSON.stringify({ title: form.get("title"), body: form.get("body") }) })
          .then(() => { toast.success("Announcement sent"); event.currentTarget.reset(); load(); emit("announcement:sent"); })
          .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not send"));
      }}>
        <Input name="title" placeholder="Announcement title" required />
        <Textarea name="body" placeholder="Message to active members" required />
        <Button type="submit">Send announcement</Button>
      </form>
    </div>
  );
}
