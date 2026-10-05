"use client";

import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { money, titleCase, when } from "@/lib/format";

type Invoice = { id: string; amount: number; currency: string; status: string; method: string | null; paidAt: string | null; manualReference: string | null; club: { name: string } };

export default function MyDuesPage() {
  const [rows, setRows] = useState<Invoice[]>([]);
  useEffect(() => { api<{ invoices: Invoice[] }>("/me/dues").then((data) => setRows(data.invoices)).catch(() => undefined); }, []);
  return (
    <div>
      <PageIntro title="Dues" />
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <Card key={row.id} className="p-4">
            <p className="font-medium">{row.club.name}</p>
            <p>{money(row.amount, row.currency)} · {titleCase(row.status)}</p>
            <p className="text-sm text-muted-foreground">{row.method ? titleCase(row.method) : "Unpaid"} {row.paidAt ? when(row.paidAt) : ""} {row.manualReference || ""}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
