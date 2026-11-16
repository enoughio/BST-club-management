"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

type PublicClub = { id: string; name: string; slug: string };

type PublicMember = {
  name: string;
  city: string | null;
  occupation: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  clubs: PublicClub[];
  adminClubs: PublicClub[];
};

export default function MemberPage() {
  const id = String(useParams().id);
  const [member, setMember] = useState<PublicMember | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ member: PublicMember }>(`/directory/members/${id}`)
      .then((data) => setMember(data.member))
      .catch(() => setError("Member not found"));
  }, [id]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <PageIntro title="Member profile" lede="Public details from the club directory." />
      {error && <p className="text-sm text-muted-foreground">{error}</p>}
      {!member && !error && <Skeleton className="h-64 w-full" />}
      {member && <Profile member={member} />}
    </main>
  );
}

function Profile({ member }: { member: PublicMember }) {
  const adminClubs = member.adminClubs ?? [];
  const clubs = new Map<string, PublicClub>();
  for (const club of member.clubs ?? []) clubs.set(club.id, club);
  for (const club of adminClubs) clubs.set(club.id, club);
  const rows = [...clubs.values()];

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar name={member.name} src={member.avatarUrl} size="lg" />
          <div className="min-w-0">
            <h2 className="font-serif text-4xl">{member.name}</h2>
            {adminClubs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {adminClubs.map((club) => (
                  <Badge key={club.id} className="bg-violet-100 text-violet-950">Club Admin · {club.name}</Badge>
                ))}
              </div>
            )}
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">City</dt>
                <dd>{member.city || "Not listed"}</dd>
              </div>
              {member.occupation && (
                <div>
                  <dt className="text-muted-foreground">Occupation</dt>
                  <dd>{member.occupation}</dd>
                </div>
              )}
              {member.email && (
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="truncate">{member.email}</dd>
                </div>
              )}
              {member.phone && (
                <div>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{member.phone}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-serif text-2xl">Clubs</h2>
        {rows.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No active club memberships.</p>}
        <ul className="mt-4 flex flex-col gap-2">
          {rows.map((club) => (
            <li key={club.id}>
              <Link href={`/clubs/${club.slug}`} className="block rounded-lg border p-3 font-medium">{club.name}</Link>
            </li>
          ))}
        </ul>
      </Card>

      <Button variant="outline" className="self-start" asChild>
        <Link href="/directory">Club directory</Link>
      </Button>
    </div>
  );
}
