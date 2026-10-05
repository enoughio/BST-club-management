"use client";

import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { api, fileUrl } from "@/lib/api";
import { money } from "@/lib/format";
import type { Club } from "@/lib/types";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function ReportsPage() {
  const [overview, setOverview] = useState<{ clubs: number; activeMemberships: number; completedMeetings: number; duesCollectedMinor: number } | null>(null);
  const [months, setMonths] = useState<{ month: string; joined: number }[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState("");
  const [health, setHealth] = useState<{ activeMembers: number; completedMeetings: number; attendanceRate: number; duesCollectedMinor: number; club: { name: string } } | null>(null);

  useEffect(() => {
    api<NonNullable<typeof overview>>("/reports/overview").then(setOverview).catch(() => undefined);
    api<{ months: { month: string; joined: number }[] }>("/reports/growth").then((data) => setMonths(data.months)).catch(() => undefined);
    api<{ clubs: Club[] }>("/clubs").then((data) => { setClubs(data.clubs); setClubId(data.clubs[0]?.id || ""); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!clubId) return;
    api<NonNullable<typeof health>>(`/reports/clubs/${clubId}/health`).then(setHealth).catch(() => undefined);
  }, [clubId]);

  return (
    <div>
      <PageIntro title="Reports" lede="Organization totals and one club at a time." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" asChild><a href={fileUrl("/api/v1/reports/overview.pdf")}>Overview PDF</a></Button>
        <Button variant="outline" asChild><a href={fileUrl("/api/v1/reports/overview.xlsx")}>Overview Excel</a></Button>
      </div>
      {overview && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4"><p className="text-sm text-muted-foreground">Clubs</p><p className="font-serif text-3xl">{overview.clubs}</p></Card>
          <Card className="p-4"><p className="text-sm text-muted-foreground">Active memberships</p><p className="font-serif text-3xl">{overview.activeMemberships}</p></Card>
          <Card className="p-4"><p className="text-sm text-muted-foreground">Completed meetings</p><p className="font-serif text-3xl">{overview.completedMeetings}</p></Card>
          <Card className="p-4"><p className="text-sm text-muted-foreground">Dues collected</p><p className="font-serif text-3xl">{money(overview.duesCollectedMinor)}</p></Card>
        </div>
      )}
      <div className="mt-6 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months}><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="joined" fill="#1e3a5f" /></BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <Select value={clubId} onChange={(event) => setClubId(event.target.value)}>{clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</Select>
        {health && <Card className="p-4"><p className="font-serif text-2xl">{health.club.name}</p><p>{health.activeMembers} active members · {health.completedMeetings} completed meetings · {Math.round(health.attendanceRate * 100)}% attendance · {money(health.duesCollectedMinor)} collected</p></Card>}
        {clubId && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" asChild><a href={fileUrl(`/api/v1/reports/clubs/${clubId}/health.pdf`)}>Club PDF</a></Button>
            <Button variant="outline" asChild><a href={fileUrl(`/api/v1/reports/clubs/${clubId}/health.xlsx`)}>Club Excel</a></Button>
          </div>
        )}
      </div>
    </div>
  );
}
