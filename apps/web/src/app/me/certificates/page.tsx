"use client";

import { useEffect, useState } from "react";
import { CertificateCard, type CertificateView } from "@/components/certificate-card";
import { PageIntro } from "@/components/shell";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<CertificateView[]>([]);
  useEffect(() => {
    api<{ certificates: CertificateView[] }>("/me/progress").then((data) => setCertificates(data.certificates)).catch(() => undefined);
  }, []);
  return (
    <div>
      <PageIntro title="Certificates" lede="Approvals from your evaluators, newest first." />
      {certificates.length === 0 && <Card className="p-4 text-sm text-muted-foreground">No certificates yet. Finish the project you are on and ask your evaluator to approve it.</Card>}
      <div className="flex flex-col gap-3">
        {certificates.map((certificate) => <CertificateCard key={certificate.id} certificate={certificate} />)}
      </div>
    </div>
  );
}
