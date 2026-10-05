"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { titleCase, when } from "@/lib/format";
import type { AgendaItem, Meeting } from "@/lib/types";

type Row = Meeting & { agenda?: AgendaItem[] };

export default function MyMeetingsPage() {
  const { user } = useSession();
  const [upcoming, setUpcoming] = useState<Row[]>([]);
  const [attended, setAttended] = useState<Row[]>([]);

  function load() {
    api<{ upcoming: Row[]; attended: Row[] }>("/me/meetings").then((data) => { setUpcoming(data.upcoming); setAttended(data.attended); }).catch(() => undefined);
  }
  useEffect(load, []);

  return (
    <div>
      <PageIntro title="Meetings" lede="Upcoming agendas you can answer, and meetings you attended." />
      <h2 className="mb-2 font-serif text-2xl">Upcoming</h2>
      <div className="flex flex-col gap-3">
        {upcoming.map((meeting) => (
          <Card key={meeting.id} className="p-4">
            <p className="font-medium">{meeting.club?.name}: {meeting.title}</p>
            <p className="text-sm text-muted-foreground">{when(meeting.meetingDate)} · {meeting.startTime} · {meeting.place}</p>
            <p className="text-sm">{meeting.agenda?.[0] ? `Your role: ${titleCase(meeting.agenda[0].role)}` : "No assigned role"}</p>
            <div className="mt-3 flex gap-2">
              {(["YES", "NO", "MAYBE"] as const).map((status) => (
                <Button key={status} variant="outline" onClick={() => api(`/meetings/${meeting.id}/rsvp`, { method: "POST", body: JSON.stringify({ status }) }).then(() => { toast.success("RSVP saved"); load(); }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not RSVP"))}>{titleCase(status)}</Button>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <h2 className="mb-2 mt-6 font-serif text-2xl">Attended</h2>
      <div className="flex flex-col gap-3">
        {attended.map((meeting) => <Attended key={meeting.id} meeting={meeting} userId={user?.id || ""} />)}
      </div>
    </div>
  );
}

function Attended({ meeting, userId }: { meeting: Row; userId: string }) {
  const [comments, setComments] = useState("");
  const [score, setScore] = useState("80");
  const evalItem = (meeting.agenda || []).find((item) => item.role === "SPEECH_EVALUATOR" && item.assigneeId === userId);
  return (
    <Card className="p-4">
      <p className="font-medium">{meeting.club?.name}: {meeting.title}</p>
      <p className="text-sm text-muted-foreground">{when(meeting.meetingDate)} · {meeting.agenda?.[0] ? titleCase(meeting.agenda[0].role) : "Attended"}</p>
      {evalItem && meeting.status === "COMPLETED" && (
        <form className="mt-3 flex flex-col gap-2" onSubmit={(event) => {
          event.preventDefault();
          api(`/meetings/${meeting.id}/feedback`, { method: "POST", body: JSON.stringify({ agendaItemId: evalItem.id, comments, score: Number(score), approved: true }) })
            .then(() => toast.success("Speech approved"))
            .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save feedback"));
        }}>
          <p className="text-sm">Feedback for your prepared speaker</p>
          <Textarea value={comments} onChange={(event) => setComments(event.target.value)} required />
          <Input value={score} onChange={(event) => setScore(event.target.value)} />
          <div className="flex gap-2">
            <Button type="submit">Approve</Button>
            <Button type="button" variant="outline" onClick={() => api(`/meetings/${meeting.id}/feedback`, { method: "POST", body: JSON.stringify({ agendaItemId: evalItem.id, comments, score: Number(score), approved: false }) }).then(() => toast.success("Feedback saved")).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save"))}>Withhold</Button>
          </div>
        </form>
      )}
    </Card>
  );
}
