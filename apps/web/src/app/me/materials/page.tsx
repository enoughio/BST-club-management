"use client";

import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Card } from "@/components/ui/card";
import { api, fileUrl } from "@/lib/api";

type Level = { id: string; name: string; number: number; projects: { id: string; title: string; materials: { id: string; title: string; kind: string }[] }[] };

export default function MaterialsPage() {
  const [levels, setLevels] = useState<Level[]>([]);
  useEffect(() => { api<{ levels: Level[] }>("/curriculum").then((data) => setLevels(data.levels)).catch(() => undefined); }, []);
  return (
    <div>
      <PageIntro title="Materials" lede="Download the speech guides. Manuscripts stay with you." />
      <div className="flex flex-col gap-3">
        {levels.map((level) => (
          <Card key={level.id} className="p-4">
            <h2 className="font-serif text-xl">Level {level.number}: {level.name}</h2>
            {level.projects.map((project) => (
              <div key={project.id} className="mt-2">
                <p className="font-medium">{project.title}</p>
                {project.materials.map((material) => (
                  <a key={material.id} className="block min-h-11 py-2 text-primary" href={fileUrl(`/api/v1/curriculum/materials/${material.id}/download`)}>{material.title}</a>
                ))}
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
