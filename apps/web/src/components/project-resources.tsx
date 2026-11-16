"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageIntro } from "@/components/shell";
import { fileUrl } from "@/lib/api";
import { kindLabel, type CurriculumProject, type LearningMaterial } from "@/lib/curriculum";

export function ProjectResources({
  project,
  backHref,
  backLabel,
  note,
}: {
  project: CurriculumProject;
  backHref: string;
  backLabel: string;
  note?: string;
}) {
  return (
    <div>
      <PageIntro
        title={project.title || "Untitled project"}
        lede={project.description?.trim() || undefined}
        actions={
          <Button variant="outline" asChild>
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        }
      />
      {note && <p className="-mt-2 mb-5 text-sm text-muted-foreground">{note}</p>}
      {project.evaluationCriteria?.trim() && (
        <section className="mb-6">
          <h2 className="font-serif text-xl">Evaluation criteria</h2>
          <p className="mt-2 text-sm">{project.evaluationCriteria}</p>
        </section>
      )}
      <section>
        <h2 className="font-serif text-xl">Materials</h2>
        {project.materials.length === 0 ? (
          <p className="mt-3 rounded-lg bg-muted px-3 py-3 text-sm">No guide yet</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {project.materials.map((material) => <MaterialCard key={material.id} material={material} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function MaterialCard({ material }: { material: LearningMaterial }) {
  const link = material.kind === "GUIDE_FILE" ? null : httpUrl(material.url);
  const downloadable = Boolean(material.fileKey && !material.id.startsWith("new-"));
  return (
    <Card className="p-4">
      <h3 className="font-serif text-xl leading-tight">{material.title || "Untitled"}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{kindLabel(material.kind)}</p>
      {material.fileName && <p className="mt-2 text-sm text-muted-foreground">{material.fileName}</p>}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {link && (
          <Button variant="outline" asChild>
            <a href={link} target="_blank" rel="noreferrer">Open link</a>
          </Button>
        )}
        {downloadable && (
          <Button variant="outline" asChild>
            <a href={fileUrl(`/api/v1/curriculum/materials/${material.id}/download`)}>Download</a>
          </Button>
        )}
      </div>
      {!link && !material.fileKey && <p className="mt-3 text-sm text-muted-foreground">No file yet</p>}
      {material.kind === "GUIDE_FILE" && material.fileKey && !downloadable && (
        <p className="mt-3 text-sm text-muted-foreground">This file can be downloaded after the curriculum is published.</p>
      )}
    </Card>
  );
}

function httpUrl(value: string | null) {
  const text = value?.trim() || "";
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
