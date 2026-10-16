"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageIntro } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";
import { when } from "@/lib/format";

type Progress = { projectId: string; approved: boolean; score: number | null; feedback: string | null };
type Level = { id: string; number: number; name: string; unlocked?: boolean; projects: { id: string; title: string }[] };
type Certificate = { id: string; title: string };

function levelUnlocked(levels: Level[], progress: Progress[], index: number) {
  if (typeof levels[index]?.unlocked === "boolean") return levels[index].unlocked;
  const approved = new Set(progress.filter((row) => row.approved).map((row) => row.projectId));
  return levels.slice(0, index).every((level) => level.projects.every((project) => approved.has(project.id)));
}

type Upcoming = { id: string; title: string; meetingDate: string; club?: { name: string } };
type Invoice = { status: string };

export default function ProgressPage() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [nextMeeting, setNextMeeting] = useState<Upcoming | null>(null);
  const [unpaid, setUnpaid] = useState(0);

  function load() {
    api<{ levels: Level[]; progress: Progress[]; certificates: Certificate[] }>("/me/progress").then((data) => {
      setLevels(data.levels);
      setProgress(data.progress);
      setCertificates(data.certificates);
    }).catch(() => undefined);
    api<{ upcoming: Upcoming[] }>("/me/meetings").then((data) => setNextMeeting(data.upcoming[0] || null)).catch(() => undefined);
    api<{ invoices: Invoice[] }>("/me/dues").then((data) => setUnpaid(data.invoices.filter((row) => row.status !== "PAID" && row.status !== "WAIVED").length)).catch(() => undefined);
  }
  useEffect(load, []);

  const approved = progress.filter((row) => row.approved).length;
  const current = levels.find((level, index) => levelUnlocked(levels, progress, index) && !level.projects.every((project) => progress.some((row) => row.projectId === project.id && row.approved)));

  return (
    <div>
      <PageIntro title="Progress" lede="Your education path, next meeting, and open dues." />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/me/meetings" className="rounded-xl border bg-card p-4" title="The next meeting you can answer.">
          <p className="text-sm text-muted-foreground">Next meeting</p>
          <p className="font-medium">{nextMeeting ? nextMeeting.title : "None scheduled"}</p>
          {nextMeeting && <p className="text-sm text-muted-foreground">{nextMeeting.club?.name} · {when(nextMeeting.meetingDate)}</p>}
        </Link>
        <Link href="/me/dues" className="rounded-xl border bg-card p-4" title="Invoices that are not paid or waived.">
          <p className="text-sm text-muted-foreground">Open dues</p>
          <p className="font-serif text-3xl">{unpaid}</p>
        </Link>
        <div className="rounded-xl border bg-card p-4" title="Projects an evaluator has approved.">
          <p className="text-sm text-muted-foreground">Projects approved</p>
          <p className="font-serif text-3xl">{approved}</p>
        </div>
        <div className="rounded-xl border bg-card p-4" title="The first level that still has an unfinished project.">
          <p className="text-sm text-muted-foreground">Current level</p>
          <p className="font-medium">{current ? `Level ${current.number}` : levels.length ? "Path complete" : "—"}</p>
        </div>
      </div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <Button asChild><Link href="/me/meetings">Answer a meeting</Link></Button>
        <Button variant="outline" asChild><Link href="/me/materials">Open curriculum</Link></Button>
        <Button variant="outline" asChild><Link href="/me/dues">View dues</Link></Button>
      </div>
      {certificates.length > 0 && <Card className="mb-4 p-4"><p className="font-medium">Certificates</p>{certificates.map((item) => <p key={item.id} className="text-sm">{item.title}</p>)}</Card>}
      <div className="flex flex-col gap-4">
        {levels.map((level, index) => {
          const unlocked = levelUnlocked(levels, progress, index);
          return (
            <section key={level.id}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-2xl">Level {level.number}: {level.name}</h2>
                {!unlocked && <Badge title={`Unlocks after Level ${levels[index - 1]?.number ?? index} completion`}><Lock className="mr-1 h-3 w-3" /> Locked</Badge>}
              </div>
              {!unlocked && <p className="mt-1 text-sm text-muted-foreground">Unlocks after Level {levels[index - 1]?.number ?? index} completion.</p>}
              <div className="mt-2 flex flex-col gap-2">
                {level.projects.map((project) => {
                  const row = progress.find((item) => item.projectId === project.id);
                  return (
                    <Card key={project.id} className={unlocked ? "p-4" : "p-4 opacity-70"}>
                      <p className="font-medium">{project.title}</p>
                      <p className="text-sm text-muted-foreground">{row?.approved ? `Approved · score ${row.score}` : row ? "Selected" : unlocked ? "Not started" : "Locked"}</p>
                      {row?.feedback && <p className="mt-1 text-sm">{row.feedback}</p>}
                      {unlocked && !row?.approved && <Button className="mt-3" variant="outline" onClick={() => api(`/me/projects/${project.id}/select`, { method: "POST", body: "{}" }).then(() => { toast.success("Project selected"); load(); }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not select"))}>Select</Button>}
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
