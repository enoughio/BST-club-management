"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { titleCase, when } from "@/lib/format";
import type { Meeting } from "@/lib/types";

const tone: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-900",
  FINALIZED: "bg-blue-100 text-blue-900",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
};

export default function OfficerHome() {
  const clubId = String(useParams().clubId);
  const { user } = useSession();
  const president = user?.offices.some((office) => office.clubId === clubId && office.title === "PRESIDENT");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  useEffect(() => {
    api<{ meetings: Meeting[] }>(`/clubs/${clubId}/meetings?scope=upcoming`).then((data) => setMeetings(data.meetings)).catch(() => undefined);
  }, [clubId]);

  const drafts = meetings.filter((meeting) => meeting.status === "DRAFT");
  const openRoles = meetings.reduce((sum, meeting) => sum + (meeting.agenda || []).filter((item) => !item.assigneeId).length, 0);
  const nextDraft = drafts[0];

  return (
    <div>
      <PageIntro title="Meetings" lede={president ? "Open a draft to finish the agenda. Cancelling a finalized meeting stays with the Club Admin." : "Upcoming meetings for your club."} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4" title="Meetings still ahead or still in draft.">
          <p className="text-sm text-muted-foreground">On the list</p>
          <p className="font-serif text-3xl">{meetings.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4" title="Drafts the President can still edit.">
          <p className="text-sm text-muted-foreground">Drafts</p>
          <p className="font-serif text-3xl">{drafts.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4" title="Agenda lines that do not have a member yet.">
          <p className="text-sm text-muted-foreground">Open roles</p>
          <p className="font-serif text-3xl">{openRoles}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" asChild><Link href={`/club/${clubId}/officer/members`}>View members</Link></Button>
        <Button variant="outline" asChild><Link href={`/club/${clubId}/officer/activity`}>Mark attendance</Link></Button>
        {president && nextDraft && <Button asChild><Link href={`/club/${clubId}/officer/meetings/${nextDraft.id}`}>Open next draft</Link></Button>}
      </div>
      <div className="mt-6 flex flex-col gap-3">
        {meetings.length === 0 && <Card className="p-4 text-sm text-muted-foreground">No upcoming meetings. The Club Admin schedules the next one.</Card>}
        {meetings.map((meeting) => {
          const assigned = (meeting.agenda || []).filter((item) => item.assigneeId).length;
          const total = meeting.agenda?.length || 0;
          return (
            <Card key={meeting.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{meeting.title}</p>
                <Badge className={tone[meeting.status] || ""}>{titleCase(meeting.status)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{when(meeting.meetingDate)} · {meeting.startTime}–{meeting.endTime}</p>
              <p className="text-sm">{total ? `${assigned} of ${total} roles assigned` : "No agenda yet"}</p>
              {president && <Link className="mt-2 inline-block text-sm text-primary" href={`/club/${clubId}/officer/meetings/${meeting.id}`}>Open builder</Link>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
