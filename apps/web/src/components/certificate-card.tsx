import { Award } from "lucide-react";
import { when } from "@/lib/format";

export type CertificateView = {
  id: string;
  title: string;
  issuedAt: string;
  memberProject?: { score: number | null; feedback: string | null; project?: { title: string } | null; evaluator?: { name: string } | null } | null;
};

export function CertificateCard({ certificate }: { certificate: CertificateView }) {
  const score = certificate.memberProject?.score;
  const comment = certificate.memberProject?.feedback;
  const evaluator = certificate.memberProject?.evaluator?.name;
  return (
    <div className="flex gap-3 rounded-xl border bg-card p-3">
      <div className="flex h-20 w-16 shrink-0 flex-col items-center justify-center rounded-md border border-blue-200 bg-red-50 text-red-800">
        <Award className="h-6 w-6" />
        <span className="mt-1 text-[9px] uppercase tracking-wide">Certificate</span>
      </div>
      <div className="min-w-0">
        <p className="font-medium">{certificate.title}</p>
        <p className="text-xs text-muted-foreground">{when(certificate.issuedAt)}{score != null ? ` · Score ${score}` : ""}{evaluator ? ` · ${evaluator}` : ""}</p>
        {comment && <p className="mt-1 line-clamp-2 text-sm">{comment}</p>}
      </div>
    </div>
  );
}
