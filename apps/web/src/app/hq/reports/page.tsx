"use client";

import { useEffect, useState } from "react";
import { OrgAnalyticsCharts, type OrgAnalytics } from "@/components/org-analytics";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { api, fileUrl } from "@/lib/api";
import { money } from "@/lib/format";
import type { Club } from "@/lib/types";

type Overview = OrgAnalytics & { clubs: number; activeMemberships: number; completedMeetings: number; duesCollectedMinor: number };

export default function ReportsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState("");
  const [health, setHealth] = useState<{ activeMembers: number; completedMeetings: number; attendanceRate: number; duesCollectedMinor: number; club: { name: string } } | null>(null);

  useEffect(() => {
    api<Overview>("/reports/overview").then(setOverview).catch(() => setOverview(null));
    api<{ clubs: Club[] }>("/clubs").then((data) => { setClubs(data.clubs); setClubId(data.clubs[0]?.id || ""); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!clubId) return;
    api<NonNullable<typeof health>>(`/reports/clubs/${clubId}/health`).then(setHealth).catch(() => setHealth(null));
  }, [clubId]);

  return (
    <div>
      <PageIntro title="Reports" lede="Organization-wide membership, meetings, retention, dues, and a club-by-club comparison." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
      <OrgAnalyticsCharts data={overview} showComparison />
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
