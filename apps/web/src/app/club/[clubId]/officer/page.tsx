"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { titleCase, when } from "@/lib/format";
import type { Meeting } from "@/lib/types";

export default function OfficerHome() {
  const clubId = String(useParams().clubId);
  const { user } = useSession();
  const president = user?.offices.some((office) => office.clubId === clubId && office.title === "PRESIDENT");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  useEffect(() => {
    api<{ meetings: Meeting[] }>(`/clubs/${clubId}/meetings?scope=upcoming`).then((data) => setMeetings(data.meetings)).catch(() => undefined);
  }, [clubId]);
  return (
    <div>
      <PageIntro title="Upcoming meetings" lede={president ? "You can open a draft and finalize it. Cancelling a finalized meeting stays with the Club Admin." : "Your upcoming club meetings."} />
      <div className="flex flex-col gap-3">
        {meetings.map((meeting) => (
          <Card key={meeting.id} className="p-4">
            <p className="font-medium">{meeting.title}</p>
            <p className="text-sm text-muted-foreground">{when(meeting.meetingDate)} · {titleCase(meeting.status)}</p>
            {president && <Link className="text-sm text-primary" href={`/club/${clubId}/officer/meetings/${meeting.id}`}>Open builder</Link>}
          </Card>
        ))}
      </div>
    </div>
  );
}
