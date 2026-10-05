"use client";

import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Card } from "@/components/ui/card";
import { api, fileUrl } from "@/lib/api";

type Material = { id: string; title: string; kind: string; url: string | null };
type Level = { id: string; name: string; number: number; projects: { id: string; title: string; materials: Material[] }[] };

function MaterialLink({ material }: { material: Material }) {
  if (material.kind === "LINK" || material.kind === "YOUTUBE") {
    if (!material.url) return <p className="py-2 text-sm">{material.title}</p>;
    return <a className="block min-h-11 py-2 text-primary" href={material.url} target="_blank" rel="noreferrer">{material.title}</a>;
  }
  return <a className="block min-h-11 py-2 text-primary" href={fileUrl(`/api/v1/curriculum/materials/${material.id}/download`)}>{material.title}</a>;
}

export default function MaterialsPage() {
  const [levels, setLevels] = useState<Level[]>([]);
  useEffect(() => { api<{ levels: Level[] }>("/curriculum").then((data) => setLevels(data.levels)).catch(() => setLevels([])); }, []);
  return (
    <div>
      <PageIntro title="Materials" lede="Open the project guide and learning links for each project. Manuscripts stay with you." />
      {levels.length === 0 && <p className="text-sm text-muted-foreground">No materials yet.</p>}
      <div className="flex flex-col gap-3">
        {levels.map((level) => (
          <Card key={level.id} className="p-4">
            <h2 className="font-serif text-xl">Level {level.number}: {level.name}</h2>
            {level.projects.map((project) => (
              <div key={project.id} className="mt-2">
                <p className="font-medium">{project.title}</p>
                {project.materials.length === 0 && <p className="text-sm text-muted-foreground">No files or links yet.</p>}
                {project.materials.map((material) => <MaterialLink key={material.id} material={material} />)}
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
