"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { money, titleCase, when } from "@/lib/format";
import { api } from "@/lib/api";

type PublicClub = {
  name: string;
  city: string;
  address: string | null;
  meetingSchedule: string | null;
  description: string | null;
  status: string;
  charterDate: string;
  membershipFeeAmount: number;
  currency: string;
};

export default function PublicClubPage() {
  const slug = String(useParams().slug);
  const [club, setClub] = useState<PublicClub | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ club: PublicClub }>(`/directory/clubs/${slug}`).then((data) => setClub(data.club)).catch(() => setError("This club is not listed."));
  }, [slug]);

  if (error) return <main className="p-8">{error}</main>;
  if (!club) return <main className="p-8">Loading…</main>;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm uppercase tracking-widest text-accent">{club.city}</p>
      <h1 className="mt-2 font-serif text-4xl text-primary">{club.name}</h1>
      <p className="mt-3 text-muted-foreground">{club.description}</p>
      <dl className="mt-6 grid gap-3 text-sm">
        <div><dt className="text-muted-foreground">Status</dt><dd>{titleCase(club.status)}</dd></div>
        <div><dt className="text-muted-foreground">Meets</dt><dd>{club.meetingSchedule || "Schedule to be announced"}</dd></div>
        <div><dt className="text-muted-foreground">Address</dt><dd>{club.address || "—"}</dd></div>
        <div><dt className="text-muted-foreground">Chartered</dt><dd>{when(club.charterDate)}</dd></div>
        <div><dt className="text-muted-foreground">Membership fee</dt><dd>{money(club.membershipFeeAmount, club.currency)}</dd></div>
      </dl>
      <Button className="mt-8" variant="outline" asChild><Link href="/directory">All clubs</Link></Button>
    </main>
  );
}
