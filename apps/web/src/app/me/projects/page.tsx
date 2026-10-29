"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MemberCurriculum } from "@/components/member-curriculum";
import { PageIntro } from "@/components/shell";
import { ApiError, api } from "@/lib/api";
import type { CurriculumLevel } from "@/lib/curriculum";

type Progress = { projectId: string; approved: boolean; score: number | null; feedback: string | null };
type Level = CurriculumLevel & { unlocked?: boolean };

export default function ProjectsPage() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);

  function load() {
    api<{ levels: Level[]; progress: Progress[] }>("/me/progress")
      .then((data) => { setLevels(data.levels); setProgress(data.progress); })
      .catch(() => setLevels([]));
  }
  useEffect(load, []);

  return (
    <div>
      <PageIntro title="Projects" lede="Every project on the path. Available ones can be started. Locked ones open after the previous level is complete. Each card includes the guide, other learning materials, and the evaluation criteria." />
      <MemberCurriculum
        levels={levels}
        progress={progress}
        onSelect={(projectId) => {
          api(`/me/projects/${projectId}/select`, { method: "POST", body: "{}" })
            .then(() => { toast.success("Project selected"); load(); })
            .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not select"));
        }}
      />
    </div>
  );
}
