"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OrgAnalyticsCharts, type OrgAnalytics } from "@/components/org-analytics";
import { PageIntro } from "@/components/shell";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

type Overview = OrgAnalytics & { clubs: number; activeMemberships: number; completedMeetings: number; duesCollectedMinor: number };

export default function HqHome() {
  const [stats, setStats] = useState<Overview | null>(null);
  useEffect(() => {
    api<Overview>("/reports/overview").then(setStats).catch(() => setStats(null));
  }, []);
  const links = [
    ["/hq/clubs", "Clubs", stats ? String(stats.clubs) : "—"],
    ["/hq/members", "Active memberships", stats ? String(stats.activeMemberships) : "—"],
    ["/hq/reports", "Completed meetings", stats ? String(stats.completedMeetings) : "—"],
    ["/hq/removals", "Dues collected", stats ? money(stats.duesCollectedMinor) : "—"],
  ];
  return (
    <div>
      <PageIntro title="Overview" lede="Organization counts, with membership, club, meeting, and retention trends." />
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map(([href, label, value]) => (
          <Link key={href} href={href}><Card className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="font-serif text-3xl">{value}</p></Card></Link>
        ))}
      </div>
      <OrgAnalyticsCharts data={stats} />
    </div>
  );
}
