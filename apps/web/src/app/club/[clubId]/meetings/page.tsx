"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { titleCase, when } from "@/lib/format";
import type { Meeting } from "@/lib/types";

export default function ClubMeetingsPage() {
  const clubId = String(useParams().clubId);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  function load() { api<{ meetings: Meeting[] }>(`/clubs/${clubId}/meetings?scope=all`).then((data) => setMeetings(data.meetings)).catch(() => undefined); }
  useEffect(load, [clubId]);
  const past = meetings.filter((meeting) => ["COMPLETED", "CANCELLED"].includes(meeting.status) || (meeting.status === "FINALIZED" && new Date(meeting.meetingDate).getTime() < Date.now()));
  const upcoming = meetings.filter((meeting) => !past.includes(meeting));

  return (
    <div>
      <PageIntro title="Meetings" lede="One meeting per club per day. Finalizing emails every active member." />
      <form className="mb-6 flex flex-col gap-3" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        api<{ meeting: Meeting }>(`/clubs/${clubId}/meetings`, { method: "POST", body: JSON.stringify({ title: form.get("title"), meetingDate: form.get("meetingDate"), startTime: form.get("startTime"), endTime: form.get("endTime"), place: form.get("place") }) })
          .then((data) => { toast.success("Draft created"); window.location.href = `/club/${clubId}/meetings/${data.meeting.id}`; })
          .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not create"));
      }}>
        <Field label="Title"><Input name="title" required defaultValue="Club meeting" /></Field>
        <Field label="Date"><Input name="meetingDate" type="date" required /></Field>
        <Field label="Start"><Input name="startTime" type="time" required defaultValue="19:00" /></Field>
        <Field label="End"><Input name="endTime" type="time" required defaultValue="21:00" /></Field>
        <Field label="Place"><Input name="place" required /></Field>
        <Button type="submit">Create draft</Button>
      </form>
      <MeetingList title="Upcoming and drafts" meetings={upcoming} clubId={clubId} />
      <MeetingList title="Past" meetings={past} clubId={clubId} />
    </div>
  );
}

function MeetingList({ title, meetings, clubId }: { title: string; meetings: Meeting[]; clubId: string }) {
  return (
    <section className="mt-4">
      <h2 className="mb-2 font-serif text-2xl">{title}</h2>
      <div className="flex flex-col gap-3">
        {meetings.map((meeting) => (
          <Link key={meeting.id} href={`/club/${clubId}/meetings/${meeting.id}`}>
            <Card className="p-4">
              <p className="font-medium">{meeting.title}</p>
              <p className="text-sm text-muted-foreground">{when(meeting.meetingDate)} · {meeting.startTime}–{meeting.endTime} · {titleCase(meeting.status)}</p>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
