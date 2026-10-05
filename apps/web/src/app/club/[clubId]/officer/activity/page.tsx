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

export default function ActivityPage() {
  const clubId = String(useParams().clubId);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [meetingId, setMeetingId] = useState("");
  const [present, setPresent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api<{ meetings: Meeting[] }>(`/clubs/${clubId}/meetings?scope=upcoming`).then((data) => { setMeetings(data.meetings); setMeetingId(data.meetings[0]?.id || ""); }).catch(() => undefined);
    api<{ members: MemberRow[] }>(`/clubs/${clubId}/members`).then((data) => {
      const active = data.members.filter((row) => row.status === "ACTIVE");
      setMembers(active);
      const next: Record<string, boolean> = {};
      for (const member of active) next[member.user.id] = true;
      setPresent(next);
    }).catch(() => undefined);
  }, [clubId]);

  return (
    <div>
      <PageIntro title="Attendance" lede="Mark who was in the room." />
      <div className="mb-3 flex flex-col gap-2">
        {meetings.map((meeting) => (
          <button key={meeting.id} className="text-left" onClick={() => setMeetingId(meeting.id)}>
            <Card className={`p-3 ${meeting.id === meetingId ? "border-primary" : ""}`}>{meeting.title} · {when(meeting.meetingDate)}</Card>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {members.map((member) => (
          <label key={member.user.id} className="flex min-h-11 items-center justify-between rounded-lg border bg-card px-3">
            {member.user.name}
            <input type="checkbox" className="h-5 w-5" checked={present[member.user.id] ?? false} onChange={(event) => setPresent({ ...present, [member.user.id]: event.target.checked })} />
          </label>
        ))}
      </div>
      <Button className="mt-4" disabled={!meetingId} onClick={() => api(`/meetings/${meetingId}/attendance`, { method: "PUT", body: JSON.stringify({ records: members.map((member) => ({ userId: member.user.id, present: Boolean(present[member.user.id]) })) }) }).then(() => toast.success("Attendance saved")).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save"))}>Save attendance</Button>
    </div>
  );
}
