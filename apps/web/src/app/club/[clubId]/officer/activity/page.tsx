"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";
import { when } from "@/lib/format";
import type { Meeting, MemberRow } from "@/lib/types";

type Mark = "present" | "late" | "absent";

export default function ActivityPage() {
  const clubId = String(useParams().clubId);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [meetingId, setMeetingId] = useState("");
  const [marks, setMarks] = useState<Record<string, Mark>>({});

  useEffect(() => {
    api<{ meetings: Meeting[] }>(`/clubs/${clubId}/meetings?scope=upcoming`).then((data) => { setMeetings(data.meetings); setMeetingId(data.meetings[0]?.id || ""); }).catch(() => undefined);
    api<{ members: MemberRow[] }>(`/clubs/${clubId}/members`).then((data) => {
      const active = data.members.filter((row) => row.status === "ACTIVE");
      setMembers(active);
      const next: Record<string, Mark> = {};
      for (const member of active) next[member.user.id] = "present";
      setMarks(next);
    }).catch(() => undefined);
  }, [clubId]);

  return (
    <div>
      <PageIntro title="Attendance" lede="Mark each member present, late, or absent. Late still counts as present." />
      {meetings.length === 0 && <Card className="p-4 text-sm text-muted-foreground">No meeting is open for attendance yet.</Card>}
      <div className="mb-3 flex flex-col gap-2">
        {meetings.map((meeting) => (
          <button key={meeting.id} className="text-left" onClick={() => setMeetingId(meeting.id)}>
            <Card className={`p-3 ${meeting.id === meetingId ? "border-primary" : ""}`}>{meeting.title} · {when(meeting.meetingDate)}</Card>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {members.map((member) => (
          <div key={member.user.id} className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{member.user.name}</span>
            <div className="flex gap-1">
              {(["present", "late", "absent"] as const).map((kind) => (
                <button key={kind} type="button" className={`rounded-full px-3 py-1 text-sm capitalize ${marks[member.user.id] === kind ? "bg-primary text-primary-foreground" : "border"}`} onClick={() => setMarks({ ...marks, [member.user.id]: kind })}>{kind}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Button className="mt-4" disabled={!meetingId} onClick={() => api(`/meetings/${meetingId}/attendance`, { method: "PUT", body: JSON.stringify({ records: members.map((member) => ({ userId: member.user.id, present: marks[member.user.id] !== "absent", late: marks[member.user.id] === "late" })) }) }).then(() => toast.success("Attendance saved")).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save"))}>Save attendance</Button>
    </div>
  );
}
