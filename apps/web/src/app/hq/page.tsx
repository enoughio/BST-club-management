"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export default function HqHome() {
  const [stats, setStats] = useState<{ clubs: number; activeMemberships: number; completedMeetings: number; duesCollectedMinor: number } | null>(null);
  useEffect(() => {
    api<NonNullable<typeof stats>>("/reports/overview").then(setStats).catch(() => undefined);
  }, []);
  const links = [
    ["/hq/clubs", "Clubs", stats ? String(stats.clubs) : "—"],
    ["/hq/members", "Active memberships", stats ? String(stats.activeMemberships) : "—"],
    ["/hq/reports", "Completed meetings", stats ? String(stats.completedMeetings) : "—"],
    ["/hq/removals", "Dues collected", stats ? money(stats.duesCollectedMinor) : "—"],
  ];
  return (
    <div>
      <PageIntro title="Overview" lede="Counts and links. Actions live on their own pages." />
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map(([href, label, value]) => (
          <Link key={href} href={href}><Card className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="font-serif text-3xl">{value}</p></Card></Link>
        ))}
      </div>
    </div>
  );
}
