"use client";

import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fileUrl } from "@/lib/api";
import { kindLabel, type CurriculumLevel } from "@/lib/curriculum";

type ProgressRow = { projectId: string; approved: boolean; score: number | null; feedback?: string | null };

export function MemberCurriculum({
  levels,
  progress = [],
  simulated = false,
  onSelect,
}: {
  levels: CurriculumLevel[];
  progress?: ProgressRow[];
  simulated?: boolean;
  onSelect?: (projectId: string) => void;
}) {
  const approved = new Set(progress.filter((row) => row.approved).map((row) => row.projectId));
  return (
    <div className="flex flex-col gap-4">
      {levels.length === 0 && <p className="text-sm text-muted-foreground">No curriculum has been published yet.</p>}
      {levels.map((level, index) => {
        const unlocked = simulated ? index === 0 : levels.slice(0, index).every((earlier) => earlier.projects.every((project) => approved.has(project.id)));
        const previous = index > 0 ? index : 0;
        return (
          <section key={level.id} className={unlocked ? "" : "rounded-xl border border-amber-200 bg-amber-50/60 p-3"}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-2xl">Level {index + 1}: {level.name || "Untitled level"}</h2>
              {!unlocked && (
                <span title={`Unlocks after Level ${previous} completion`} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-950">
                  <Lock className="h-3.5 w-3.5" /> Locked
                </span>
              )}
            </div>
            {!unlocked && <p className="mt-1 text-sm text-amber-950">Unlocks after Level {previous} completion.</p>}
            <div className="mt-3 flex flex-col gap-2">
              {level.projects.map((project, projectIndex) => {
                const row = progress.find((item) => item.projectId === project.id);
                const simulatedState = index > 0 ? "Locked" : projectIndex === 0 ? "In progress" : "Not started";
                const state = simulated ? simulatedState : row?.approved ? "Approved" : row ? "In progress" : unlocked ? "Not started" : "Locked";
                return (
                  <Card key={project.id} className={unlocked ? "p-4" : "p-4 opacity-80"}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium">{project.title || "Untitled project"}</p>
                      <Badge className={state === "Approved" ? "bg-emerald-100 text-emerald-900" : state === "In progress" ? "bg-sky-100 text-sky-900" : state === "Locked" ? "bg-amber-100 text-amber-950" : ""}>{state}{row?.approved && row.score != null ? ` · ${row.score}` : ""}</Badge>
                    </div>
                    {project.description && <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>}
                    {project.evaluationCriteria && <p className="mt-2 text-sm"><span className="font-medium">Evaluation criteria. </span>{project.evaluationCriteria}</p>}
                    {row?.feedback && <p className="mt-2 text-sm">{row.feedback}</p>}
                    <ul className="mt-3 flex flex-col gap-1">
                      {project.materials.length === 0 && <li className="text-sm text-muted-foreground">No learning materials yet.</li>}
                      {project.materials.map((material) => (
                        <li key={material.id} className="text-sm">
                          <MaterialLink material={material} locked={!unlocked} />
                        </li>
                      ))}
                    </ul>
                    {unlocked && onSelect && !row && (
                      <Button className="mt-3" variant="outline" onClick={() => onSelect(project.id)}>Select project</Button>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MaterialLink({ material, locked }: { material: CurriculumLevel["projects"][number]["materials"][number]; locked: boolean }) {
  const label = `${kindLabel(material.kind)} · ${material.title || "Untitled"}`;
  if (locked) return <span className="text-muted-foreground">{label}</span>;
  if (material.url) return <a className="text-primary" href={material.url} target="_blank" rel="noreferrer">{label}</a>;
  if (material.fileKey && !material.id.startsWith("new-")) {
    return <a className="text-primary" href={fileUrl(`/api/v1/curriculum/materials/${material.id}/download`)}>{label}</a>;
  }
  return <span>{label}{material.fileName ? ` · ${material.fileName}` : ""}</span>;
}
