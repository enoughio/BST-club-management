"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { titleCase, when } from "@/lib/format";
import { useSession } from "@/lib/session";

type Level = { number: number; name: string; unlocked?: boolean; projects: { id: string }[] };
type Progress = { projectId: string; approved: boolean };

export default function ProfilePage() {
  const { user } = useSession();
  const [level, setLevel] = useState<string>("—");
  useEffect(() => {
    api<{ levels: Level[]; progress: Progress[] }>("/me/progress").then((data) => {
      const approved = new Set(data.progress.filter((row) => row.approved).map((row) => row.projectId));
      const current = data.levels.find((item, index) => {
        const open = typeof item.unlocked === "boolean" ? item.unlocked : data.levels.slice(0, index).every((earlier) => earlier.projects.every((project) => approved.has(project.id)));
        return open && !item.projects.every((project) => approved.has(project.id));
      });
      setLevel(current ? `Level ${current.number}: ${current.name}` : data.levels.length ? "Path complete" : "—");
    }).catch(() => undefined);
  }, []);
  if (!user) return null;
  const joined = user.memberships.slice().sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())[0];
  return (
    <div>
      <PageIntro title="Profile" lede="The details your club has on file, and where you are on the path." actions={<Button asChild><Link href="/me/profile/edit">Edit profile</Link></Button>} />
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar name={user.name} src={user.avatarUrl} size="lg" />
          <div className="min-w-0">
            <p className="font-serif text-3xl">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Phone</dt><dd>{user.phone || "Not set"}</dd></div>
              <div><dt className="text-muted-foreground">City</dt><dd>{user.city || "Not set"}</dd></div>
              <div><dt className="text-muted-foreground">Joined</dt><dd>{joined ? when(joined.joinedAt) : "Not a member yet"}</dd></div>
              <div><dt className="text-muted-foreground">Current level</dt><dd>{level}</dd></div>
            </dl>
            {user.memberships.length > 0 && (
              <div className="mt-3 flex flex-col gap-1 text-sm">
                {user.memberships.map((row) => <p key={row.id}>{row.clubName} · {titleCase(row.status)}</p>)}
              </div>
            )}
            <Button className="mt-4" variant="outline" asChild><Link href="/me/history">View full history</Link></Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
