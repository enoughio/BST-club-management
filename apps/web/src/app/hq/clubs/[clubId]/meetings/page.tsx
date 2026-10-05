"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { titleCase, when } from "@/lib/format";
import type { Meeting } from "@/lib/types";

export default function HqMeetingsPage() {
  const clubId = String(useParams().clubId);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [open, setOpen] = useState<Meeting | null>(null);

  useEffect(() => {
    api<{ meetings: Meeting[] }>(`/clubs/${clubId}/meetings?scope=all`).then((data) => setMeetings(data.meetings)).catch(() => undefined);
  }, [clubId]);

  async function show(id: string) {
    const data = await api<{ meeting: Meeting }>(`/meetings/${id}`);
    setOpen(data.meeting);
  }

  const past = meetings.filter((meeting) => ["COMPLETED", "CANCELLED"].includes(meeting.status) || (meeting.status === "FINALIZED" && new Date(meeting.meetingDate).getTime() < Date.now()));
  const upcoming = meetings.filter((meeting) => !past.includes(meeting));

  return (
    <div>
      <PageIntro title="Meetings" lede="Open any meeting to read the agenda, attendance, and summary." />
      <Section title="Upcoming and drafts" meetings={upcoming} onOpen={show} />
      <Section title="Past" meetings={past} onOpen={show} />
      {open && (
        <div className="mt-6 flex flex-col gap-3">
          <h2 className="font-serif text-2xl">{open.title}</h2>
          <p className="text-sm text-muted-foreground">{titleCase(open.status)} · {open.place}</p>
          {(open.agenda || []).map((item) => (
            <Card key={item.id} className="p-3 text-sm">
              <p className="font-medium">{titleCase(item.role)} · {item.title}</p>
              <p>{item.assignee?.name || "Unassigned"}{item.project ? ` · ${item.project.title}` : ""}</p>
            </Card>
          ))}
          <p>{open.summary || "No summary yet."}</p>
          <div className="flex flex-col gap-2">
            {(open.attendance || []).map((row) => <Card key={row.id} className="p-3 text-sm">{row.user?.name} · {row.present ? "Present" : "Absent"}</Card>)}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, meetings, onOpen }: { title: string; meetings: Meeting[]; onOpen: (id: string) => void }) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 font-serif text-2xl">{title}</h2>
      <div className="flex flex-col gap-3">
        {meetings.map((meeting) => (
          <button key={meeting.id} className="text-left" onClick={() => onOpen(meeting.id)}>
            <Card className="p-4">
              <p className="font-medium">{meeting.title}</p>
              <p className="text-sm text-muted-foreground">{when(meeting.meetingDate)} · {meeting.startTime} · {titleCase(meeting.status)}</p>
            </Card>
          </button>
        ))}
        {meetings.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
      </div>
    </section>
  );
}
