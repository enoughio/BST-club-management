"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProjectResources } from "@/components/project-resources";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { CurriculumLevel, CurriculumProject } from "@/lib/curriculum";

type Builder = { source: "draft" | "published"; levels: CurriculumLevel[] };

export default function CurriculumProjectPage() {
  const projectId = String(useParams().projectId);
  const [status, setStatus] = useState<"loading" | "missing" | "ready">("loading");
  const [project, setProject] = useState<CurriculumProject | null>(null);
  const [source, setSource] = useState<"draft" | "published">("published");

  useEffect(() => {
    let active = true;
    api<Builder>("/curriculum/builder")
      .then((data) => {
        if (!active) return;
        const found = data.levels.flatMap((level) => level.projects).find((item) => item.id === projectId) || null;
        setSource(data.source);
        setProject(found);
        setStatus(found ? "ready" : "missing");
      })
      .catch(() => {
        if (active) setStatus("missing");
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  if (status === "loading") return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (status === "missing" || !project) {
    return (
      <div>
        <PageIntro title="Project" lede="This project is not in the saved curriculum. Save the draft, then open it again." />
        <Button variant="outline" asChild>
          <Link href="/hq/curriculum">Back to curriculum</Link>
        </Button>
      </div>
    );
  }
  return (
    <ProjectResources
      project={project}
      backHref="/hq/curriculum"
      backLabel="Back to curriculum"
      note={source === "draft" ? "This is the draft. Members still see the published curriculum until you publish." : undefined}
    />
  );
}
