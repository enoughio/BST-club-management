"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageIntro } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";

type Progress = { projectId: string; approved: boolean; score: number | null; feedback: string | null };
type Level = { id: string; number: number; name: string; unlocked?: boolean; projects: { id: string; title: string }[] };
type Certificate = { id: string; title: string };

function levelUnlocked(levels: Level[], progress: Progress[], index: number) {
  if (typeof levels[index]?.unlocked === "boolean") return levels[index].unlocked;
  const approved = new Set(progress.filter((row) => row.approved).map((row) => row.projectId));
  return levels.slice(0, index).every((level) => level.projects.every((project) => approved.has(project.id)));
}

export default function ProgressPage() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  function load() {
    api<{ levels: Level[]; progress: Progress[]; certificates: Certificate[] }>("/me/progress").then((data) => {
      setLevels(data.levels);
      setProgress(data.progress);
      setCertificates(data.certificates);
    }).catch(() => undefined);
  }
  useEffect(load, []);

  return (
    <div>
      <PageIntro title="Education path" lede="Select a project, deliver it as a prepared speaker, and your speech evaluator approves it after the meeting." />
      {certificates.length > 0 && <Card className="mb-4 p-4"><p className="font-medium">Certificates</p>{certificates.map((item) => <p key={item.id} className="text-sm">{item.title}</p>)}</Card>}
      <div className="flex flex-col gap-4">
        {levels.map((level, index) => {
          const unlocked = levelUnlocked(levels, progress, index);
          return (
            <section key={level.id}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-2xl">Level {level.number}: {level.name}</h2>
                {!unlocked && <Badge>Locked</Badge>}
              </div>
              {!unlocked && <p className="mt-1 text-sm text-muted-foreground">Complete every project in the previous level before starting this one.</p>}
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
