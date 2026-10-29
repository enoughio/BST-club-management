"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageIntro } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { roleIcon } from "@/lib/child";
import { titleCase, when } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { AgendaItem, Meeting } from "@/lib/types";

type Row = Meeting & {
  agenda?: AgendaItem[];
  attendance?: { present: boolean; late: boolean }[];
  rsvps?: { status: string }[];
};

export default function MyMeetingsPage() {
  const { user } = useSession();
  const [upcoming, setUpcoming] = useState<Row[]>([]);
  const [past, setPast] = useState<Row[]>([]);

  function load() {
    api<{ upcoming: Row[]; past?: Row[]; attended?: Row[] }>("/me/meetings")
      .then((data) => { setUpcoming(data.upcoming); setPast(data.past || data.attended || []); })
      .catch(() => undefined);
  }
  useEffect(load, []);

  return (
    <div>
      <PageIntro title="Meetings" lede="Answer upcoming meetings, then look back at where you attended and which role you held." />
      <h2 className="mb-2 font-serif text-2xl">Upcoming</h2>
      {upcoming.length === 0 && (
        <Card className="mb-4 p-4">
          <p className="font-medium">No meetings scheduled</p>
          <p className="text-sm text-muted-foreground">Your club has not finalized an upcoming agenda. This page is the calendar those meetings will land on.</p>
        </Card>
      )}
      <div className="flex flex-col gap-3">
        {upcoming.map((meeting) => {
          const roles = (meeting.agenda || []).map((item) => `${roleIcon(item.role)} ${titleCase(item.role)}`);
          const rsvp = meeting.rsvps?.[0]?.status;
          return (
            <Card key={meeting.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{meeting.club?.name}: {meeting.title}</p>
                  <p className="text-sm">{when(meeting.meetingDate)} · {meeting.startTime}–{meeting.endTime}</p>
                  <p className="text-sm text-muted-foreground">{meeting.place}</p>
                  <p className="mt-1 text-sm">{roles.length ? `Your role: ${roles.join(", ")}` : "No assigned role yet"}</p>
                </div>
                {rsvp && <Badge>{titleCase(rsvp)}</Badge>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["YES", "NO", "MAYBE"] as const).map((status) => (
                  <Button key={status} variant={rsvp === status ? "default" : "outline"} onClick={() => api(`/meetings/${meeting.id}/rsvp`, { method: "POST", body: JSON.stringify({ status }) }).then(() => { toast.success("RSVP saved"); load(); }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not RSVP"))}>{titleCase(status)}</Button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-2 mt-6 font-serif text-2xl">Past</h2>
      {past.length === 0 && <Card className="p-4 text-sm text-muted-foreground">Completed meetings will list the date, whether you were there, and the role you held.</Card>}
      <div className="flex flex-col gap-3">
        {past.map((meeting) => <PastMeeting key={meeting.id} meeting={meeting} userId={user?.id || ""} />)}
      </div>
    </div>
  );
}

function PastMeeting({ meeting, userId }: { meeting: Row; userId: string }) {
  const [comments, setComments] = useState("");
  const [score, setScore] = useState("80");
  const record = meeting.attendance?.[0];
  const attendance = !record ? "Absent" : record.late ? "Late" : record.present ? "Present" : "Absent";
  const roles = (meeting.agenda || []).map((item) => `${roleIcon(item.role)} ${titleCase(item.role)}`);
  const evalItem = (meeting.agenda || []).find((item) => item.role === "SPEECH_EVALUATOR" && item.assigneeId === userId);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{meeting.club?.name}: {meeting.title}</p>
          <p className="text-sm text-muted-foreground">{when(meeting.meetingDate)} · {meeting.place}</p>
          <p className="text-sm">{roles.length ? roles.join(", ") : "No assigned role"}</p>
        </div>
        <Badge className={attendance === "Present" ? "bg-blue-100 text-blue-900" : attendance === "Late" ? "bg-red-100 text-red-900" : "bg-red-50 text-red-800"}>{attendance}</Badge>
      </div>
      {evalItem && (
        <form className="mt-3 flex flex-col gap-2" onSubmit={(event) => {
          event.preventDefault();
          api(`/meetings/${meeting.id}/feedback`, { method: "POST", body: JSON.stringify({ agendaItemId: evalItem.id, comments, score: Number(score), approved: true }) })
            .then(() => toast.success("Speech approved"))
            .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save feedback"));
        }}>
          <p className="text-sm font-medium">Evaluation still with you</p>
          <p className="text-xs text-muted-foreground">You were the speech evaluator. Record the score and a short comment for the speaker.</p>
          <Textarea value={comments} onChange={(event) => setComments(event.target.value)} required />
          <Input value={score} onChange={(event) => setScore(event.target.value)} aria-label="Score" />
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Approve</Button>
            <Button type="button" variant="outline" onClick={() => api(`/meetings/${meeting.id}/feedback`, { method: "POST", body: JSON.stringify({ agendaItemId: evalItem.id, comments, score: Number(score), approved: false }) }).then(() => toast.success("Feedback saved")).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save"))}>Withhold</Button>
          </div>
        </form>
      )}
    </Card>
  );
}
