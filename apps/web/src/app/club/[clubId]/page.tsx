"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Club, Meeting, MemberRow } from "@/lib/types";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function ClubHome() {
  const clubId = String(useParams().clubId);
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState(0);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  useEffect(() => {
    api<{ club: Club; members: MemberRow[] }>(`/clubs/${clubId}`).then((data) => { setClub(data.club); setMembers(data.members.filter((row) => row.status === "ACTIVE").length); }).catch(() => undefined);
    api<{ meetings: Meeting[] }>(`/clubs/${clubId}/meetings?scope=all`).then((data) => setMeetings(data.meetings)).catch(() => undefined);
  }, [clubId]);
  const chart = ["DRAFT", "FINALIZED", "COMPLETED", "CANCELLED"].map((status) => ({ status, count: meetings.filter((meeting) => meeting.status === status).length }));
  return (
    <div>
      <PageIntro title={club?.name || "Club"} lede="Counts and links. Open a section to take action." />
      <div className="grid gap-3">
        <Link href={`/club/${clubId}/members`}><Card className="p-4"><p className="text-sm text-muted-foreground">Active members</p><p className="font-serif text-3xl">{members}</p></Card></Link>
        <Link href={`/club/${clubId}/meetings`}><Card className="p-4"><p className="text-sm text-muted-foreground">Meetings on record</p><p className="font-serif text-3xl">{meetings.length}</p></Card></Link>
        <Link href={`/club/${clubId}/committee`}><Card className="p-4">Current and past committees</Card></Link>
      </div>
      <div className="mt-6 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart}><XAxis dataKey="status" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#9a3412" /></BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
