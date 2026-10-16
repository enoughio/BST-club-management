"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MemberCurriculum } from "@/components/member-curriculum";
import { PageIntro } from "@/components/shell";
import { ApiError, api } from "@/lib/api";
import type { CurriculumLevel } from "@/lib/curriculum";

type Progress = { projectId: string; approved: boolean; score: number | null; feedback: string | null };
type Level = CurriculumLevel & { unlocked?: boolean };

export default function MaterialsPage() {
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
      <PageIntro title="Curriculum" lede="Levels unlock in order. Open the learning materials for the level you are on. Manuscripts stay with you." />
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
