"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { money, titleCase, when } from "@/lib/format";

type Invoice = { id: string; amount: number; currency: string; status: string; method: string | null; manualReference: string | null; paidAt: string | null; user: { name: string; email: string } };

export default function DuesPage() {
  const clubId = String(useParams().clubId);
  const [rows, setRows] = useState<Invoice[]>([]);
  useEffect(() => { api<{ invoices: Invoice[] }>(`/clubs/${clubId}/dues`).then((data) => setRows(data.invoices)).catch(() => undefined); }, [clubId]);
  return (
    <div>
      <PageIntro title="Dues" lede="Paid and unpaid invoices. New members pay on the application page." />
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <Card key={row.id} className="p-4">
            <p className="font-medium">{row.user.name}</p>
            <p className="text-sm text-muted-foreground">{row.user.email}</p>
            <p>{money(row.amount, row.currency)} · {titleCase(row.status)}{row.method ? ` · ${titleCase(row.method)}` : ""}</p>
            <p className="text-sm">{row.manualReference || ""} {row.paidAt ? when(row.paidAt) : ""}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
