"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProjectResources } from "@/components/project-resources";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { CurriculumLevel, CurriculumProject } from "@/lib/curriculum";

type Level = CurriculumLevel & { unlocked?: boolean };

export default function MemberProjectPage() {
  const projectId = String(useParams().projectId);
  const [status, setStatus] = useState<"loading" | "missing" | "locked" | "ready">("loading");
  const [project, setProject] = useState<CurriculumProject | null>(null);

  useEffect(() => {
    let active = true;
    api<{ levels: Level[] }>("/me/progress")
      .then((data) => {
        if (!active) return;
        const found = findProject(data.levels, projectId);
        if (!found) {
          setProject(null);
          setStatus("missing");
          return;
        }
        setProject(found.project);
        setStatus(found.level.unlocked === false ? "locked" : "ready");
      })
      .catch(() => {
        if (active) setStatus("missing");
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  if (status === "loading") return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (status === "locked") {
    return (
      <div>
        <PageIntro title="Project" lede="Complete every project in the earlier level before opening this one." />
        <Button variant="outline" asChild>
          <Link href="/me/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }
  if (status === "missing" || !project) {
    return (
      <div>
        <PageIntro title="Project" lede="This project is not in the published curriculum." />
        <Button variant="outline" asChild>
          <Link href="/me/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }
  return <ProjectResources project={project} backHref="/me/projects" backLabel="Back to projects" />;
}

function findProject(levels: Level[], projectId: string) {
  for (const level of levels) {
    const project = level.projects.find((item) => item.id === projectId);
    if (project) return { level, project };
  }
  return null;
}
