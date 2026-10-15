"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDashboardBus } from "@/components/dashboard-bus";
import { Field, PageIntro } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { ApiError, api } from "@/lib/api";
import { titleCase, when } from "@/lib/format";
import type { Meeting, MemberRow } from "@/lib/types";

const badgeTone: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-900",
  FINALIZED: "bg-sky-100 text-sky-900",
  COMPLETED: "bg-stone-200 text-stone-700",
  CANCELLED: "bg-stone-100 text-stone-500",
};

export default function ClubMeetingsPage() {
  const clubId = String(useParams().clubId);
  const router = useRouter();
  const { emit } = useDashboardBus();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [cancelFor, setCancelFor] = useState<Meeting | null>(null);
  const [finalizeFor, setFinalizeFor] = useState<Meeting | null>(null);
  const [reason, setReason] = useState("");
  const [attendanceFor, setAttendanceFor] = useState<Meeting | null>(null);
  const [marks, setMarks] = useState<Record<string, "present" | "absent" | "late">>({});

  function load() {
    api<{ meetings: Meeting[] }>(`/clubs/${clubId}/meetings?scope=all`).then((data) => setMeetings(data.meetings)).catch(() => undefined);
    api<{ members: MemberRow[] }>(`/clubs/${clubId}/members`).then((data) => setMembers(data.members.filter((row) => row.status === "ACTIVE"))).catch(() => undefined);
  }
  useEffect(load, [clubId]);
  /** Reload here and let the activity rail know its draft/attendance alerts may have changed. */
  function changed() {
    load();
    emit("meeting:changed");
  }

  const past = meetings.filter((meeting) => ["COMPLETED", "CANCELLED"].includes(meeting.status) || (meeting.status === "FINALIZED" && new Date(meeting.meetingDate).getTime() < Date.now() - 86400000));
  const upcoming = meetings.filter((meeting) => !past.includes(meeting));

  function openAttendance(meeting: Meeting) {
    const next: Record<string, "present" | "absent" | "late"> = {};
    for (const member of members) {
      const row = meeting.attendance?.find((item) => item.userId === member.user.id);
      next[member.user.id] = row?.late ? "late" : row?.present ? "present" : row ? "absent" : "absent";
    }
    setMarks(next);
    setAttendanceFor(meeting);
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageIntro title="Meetings" />
        <Button onClick={() => setCreateOpen(true)}>Create new meeting</Button>
      </div>
      <Section title="Upcoming and drafts" meetings={upcoming} onOpen={setSelected} onFinalize={setFinalizeFor} onCancel={(meeting) => { setReason(""); setCancelFor(meeting); }} onAttendance={openAttendance} />
      <Section title="Past meetings" meetings={past} onOpen={setSelected} onFinalize={setFinalizeFor} onCancel={(meeting) => { setReason(""); setCancelFor(meeting); }} onAttendance={openAttendance} />

      <Sheet open={createOpen} onOpenChange={setCreateOpen} title="New meeting">
        <form className="flex flex-col gap-3" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const date = String(form.get("meetingDate"));
          if (meetings.some((meeting) => meeting.status !== "CANCELLED" && meeting.meetingDate.slice(0, 10) === date)) {
            toast.error("This club already has a meeting that day");
            return;
          }
          api<{ meeting: Meeting }>(`/clubs/${clubId}/meetings`, { method: "POST", body: JSON.stringify({ title: form.get("title"), meetingDate: date, startTime: form.get("startTime"), endTime: form.get("endTime"), place: form.get("place") }) })
            .then((data) => router.push(`/club/${clubId}/meetings/${data.meeting.id}`))
            .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not create"));
        }}>
          <Field label="Title"><Input name="title" required defaultValue="Club meeting" /></Field>
          <Field label="Date"><Input name="meetingDate" type="date" required /></Field>
          <Field label="Start"><Input name="startTime" type="time" required defaultValue="19:00" /></Field>
          <Field label="End"><Input name="endTime" type="time" required defaultValue="21:00" /></Field>
          <Field label="Place"><Input name="place" required /></Field>
          <Button type="submit">Open the agenda builder</Button>
        </form>
      </Sheet>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected?.title || "Meeting"}>
        {selected && (
          <div className="flex flex-col gap-3 text-sm">
            <p>{when(selected.meetingDate)} · {selected.startTime}–{selected.endTime}</p>
            <p>{selected.place}</p>
            <h3 className="font-serif text-xl">Agenda</h3>
            {(selected.agenda || []).length === 0 && <p className="text-muted-foreground">No agenda items yet.</p>}
            {(selected.agenda || []).map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">{titleCase(item.role)}</p>
                <p className="font-medium">{item.title}</p>
                <p>{item.assigneeId ? "Assigned" : "Unassigned"}</p>
              </div>
            ))}
            <Button variant="outline" onClick={() => router.push(`/club/${clubId}/meetings/${selected.id}`)}>Open builder</Button>
          </div>
        )}
      </Sheet>

      <ConfirmDialog open={Boolean(finalizeFor)} onOpenChange={(open) => { if (!open) setFinalizeFor(null); }} title="Finalize this meeting?" description="Finalizing emails every active member the agenda, time, and place. You cannot send a second finalized meeting for the same day." confirmLabel="Finalize and send" onConfirm={() => {
        if (!finalizeFor) return;
        api(`/meetings/${finalizeFor.id}/finalize`, { method: "POST", body: "{}" })
          .then(() => { toast.success("Members emailed"); setFinalizeFor(null); changed(); })
          .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not finalize"));
      }} />

      <ConfirmDialog open={Boolean(cancelFor)} onOpenChange={(open) => { if (!open) setCancelFor(null); }} title="Cancel this meeting?" description="Members are emailed as soon as you confirm. Add the reason they should see." confirmLabel="Cancel and email" destructive confirmDisabled={reason.trim().length < 3} onConfirm={() => {
        if (!cancelFor) return;
        api(`/meetings/${cancelFor.id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) })
          .then(() => { toast.success("Cancellation sent"); setCancelFor(null); changed(); })
          .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not cancel"));
      }}>
        <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" />
      </ConfirmDialog>

      <Sheet open={Boolean(attendanceFor)} onOpenChange={(open) => { if (!open) setAttendanceFor(null); }} title="Attendance">
        <div className="flex flex-col gap-3">
          {members.map((member) => (
            <label key={member.user.id} className="flex items-center justify-between gap-3 text-sm">
              <span>{member.user.name}</span>
              <Select value={marks[member.user.id] || "absent"} onChange={(event) => setMarks({ ...marks, [member.user.id]: event.target.value as "present" | "absent" | "late" })}>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
              </Select>
            </label>
          ))}
          <Button onClick={() => {
            if (!attendanceFor) return;
            const records = Object.entries(marks).map(([userId, mark]) => ({ userId, present: mark !== "absent", late: mark === "late" }));
            api(`/meetings/${attendanceFor.id}/attendance`, { method: "PUT", body: JSON.stringify({ records }) })
              .then(() => { toast.success("Attendance saved"); setAttendanceFor(null); changed(); })
              .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save attendance"));
          }}>Save attendance</Button>
        </div>
      </Sheet>
    </div>
  );
}

function Section({ title, meetings, onOpen, onFinalize, onCancel, onAttendance }: {
  title: string;
  meetings: Meeting[];
  onOpen: (meeting: Meeting) => void;
  onFinalize: (meeting: Meeting) => void;
  onCancel: (meeting: Meeting) => void;
  onAttendance: (meeting: Meeting) => void;
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 font-serif text-2xl">{title}</h2>
      <div className="flex flex-col gap-3">
        {meetings.length === 0 && <p className="text-sm text-muted-foreground">Nothing in this section.</p>}
        {meetings.map((meeting) => {
          const assigned = (meeting.agenda || []).filter((item) => item.assigneeId).length;
          const total = (meeting.agenda || []).length;
          return (
            <Card key={meeting.id} className="p-4">
              <button type="button" className="w-full text-left" onClick={() => onOpen(meeting)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{meeting.title}</p>
                    <p className="text-sm text-muted-foreground">{when(meeting.meetingDate)} · {meeting.startTime}–{meeting.endTime}</p>
                    <p className="text-sm">{assigned} of {total} roles assigned</p>
                  </div>
                  <Badge className={badgeTone[meeting.status] || ""}>{titleCase(meeting.status)}</Badge>
                </div>
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                {meeting.status === "DRAFT" && <Button type="button" onClick={() => onFinalize(meeting)}>Finalize</Button>}
                {meeting.status === "FINALIZED" && <Button type="button" variant="destructive" onClick={() => onCancel(meeting)}>Cancel</Button>}
                {["COMPLETED", "FINALIZED"].includes(meeting.status) && <Button type="button" variant="outline" onClick={() => onAttendance(meeting)}>View attendance</Button>}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
