"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { titleCase } from "@/lib/format";

type ClubCard = { id: string; name: string; slug: string; city: string; meetingSchedule: string | null; status: string; description: string | null };

export default function DirectoryPage() {
  const [q, setQ] = useState("");
  const [clubs, setClubs] = useState<ClubCard[]>([]);

  useEffect(() => {
    const handle = setTimeout(() => {
      api<{ clubs: ClubCard[] }>(`/directory/clubs?q=${encodeURIComponent(q)}`).then((data) => setClubs(data.clubs)).catch(() => setClubs([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl text-primary">Club directory</h1>
      <p className="mt-2 text-muted-foreground">Search by city or club name.</p>
      <Input className="mt-5" placeholder="Mumbai, Pune, Harbour…" value={q} onChange={(event) => setQ(event.target.value)} />
      <div className="mt-5 flex flex-col gap-3">
        {clubs.map((club) => (
          <Link key={club.id} href={`/clubs/${club.slug}`}>
            <Card>
              <CardHeader>
                <CardTitle>{club.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{club.city} · {titleCase(club.status)}</p>
              </CardHeader>
              <CardContent>
                <p>{club.description}</p>
                {club.meetingSchedule && <p className="mt-2 text-sm">{club.meetingSchedule}</p>}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
