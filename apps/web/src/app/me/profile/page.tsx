"use client";

import Link from "next/link";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fileUrl } from "@/lib/api";
import { useSession } from "@/lib/session";
import { titleCase, when } from "@/lib/format";

export default function ProfilePage() {
  const { user } = useSession();
  if (!user) return null;
  return (
    <div>
      <PageIntro title="Profile" />
      <Card className="p-4">
        {user.avatarUrl && <img src={fileUrl(user.avatarUrl)} alt="" className="mb-3 h-16 w-16 rounded-full object-cover" />}
        <p className="font-serif text-2xl">{user.name}</p>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <p className="mt-3 text-sm">{[user.phone, user.city, user.occupation].filter(Boolean).join(" · ")}</p>
        <p className="mt-2 text-sm">{user.goals}</p>
        <p className="mt-2 text-sm">Born {when(user.dateOfBirth)} · {user.gender || "Gender not set"}</p>
        <div className="mt-3 flex flex-col gap-1 text-sm">
          {user.memberships.map((row) => <p key={row.id}>{row.clubName} · {titleCase(row.status)}</p>)}
        </div>
        <Button className="mt-4" asChild><Link href="/me/profile/edit">Edit</Link></Button>
      </Card>
    </div>
  );
}
