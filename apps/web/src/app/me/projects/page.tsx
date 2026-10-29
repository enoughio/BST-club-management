"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { CertificateView } from "@/components/certificate-card";
import { MemberCurriculum } from "@/components/member-curriculum";
import { PageIntro } from "@/components/shell";
import { ApiError, api } from "@/lib/api";
import type { CurriculumLevel } from "@/lib/curriculum";
import { useSession } from "@/lib/session";

type Progress = { projectId: string; approved: boolean; score: number | null; feedback: string | null; approvedAt?: string | null };
type Level = CurriculumLevel & { unlocked?: boolean; number?: number };

export default function ProjectsPage() {
  const { user } = useSession();
  const [levels, setLevels] = useState<Level[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [certificates, setCertificates] = useState<CertificateView[]>([]);

  function load() {
    api<{ levels: Level[]; progress: Progress[]; certificates: CertificateView[] }>("/me/progress")
      .then((data) => {
        setLevels(data.levels);
        setProgress(data.progress);
        setCertificates(data.certificates || []);
      })
      .catch(() => setLevels([]));
  }
  useEffect(load, []);

  return (
    <div>
      <PageIntro
        title="Projects"
        lede="Your path, one level at a time. The level you are on is open. Later levels unlock when every project before them is approved."
      />
      <MemberCurriculum
        levels={levels}
        progress={progress}
        certificates={certificates}
        memberName={user?.name || "Member"}
        onSelect={(projectId) => {
          api(`/me/projects/${projectId}/select`, { method: "POST", body: "{}" })
            .then(() => { toast.success("You're on this project"); load(); })
            .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not select"));
        }}
      />
    </div>
  );
}
