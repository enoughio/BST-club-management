"use client";

import Link from "next/link";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { titleCase } from "@/lib/format";
import { useSession } from "@/lib/session";
import { officesByClub } from "@/lib/types";

export default function OfficerDutiesPage() {
  const { user } = useSession();
  const clubs = officesByClub(user?.offices || []);

  return (
    <div>
      <PageIntro
        title="Officer duties"
        lede="This stays inside your member home. The links below open the meetings you can run, the read-only roster, and attendance for each office you hold."
      />
      {clubs.length === 0 && <Card className="p-4 text-sm text-muted-foreground">You do not hold a current officer role.</Card>}
      <div className="flex flex-col gap-3">
        {clubs.map((club) => (
          <Card key={club.clubId} className="p-4">
            <p className="font-medium">{club.clubName}</p>
            <p className="text-sm text-muted-foreground">{club.titles.map((title) => titleCase(title)).join(" · ")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" asChild><Link href={`/club/${club.clubId}/officer`}>Meetings</Link></Button>
              <Button variant="outline" asChild><Link href={`/club/${club.clubId}/officer/members`}>Roster</Link></Button>
              <Button variant="outline" asChild><Link href={`/club/${club.clubId}/officer/activity`}>Activity</Link></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
