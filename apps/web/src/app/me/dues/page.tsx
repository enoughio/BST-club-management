"use client";

import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { money, titleCase, when } from "@/lib/format";

type Invoice = { id: string; amount: number; currency: string; status: string; method: string | null; paidAt: string | null; manualReference: string | null; createdAt?: string; club: { name: string } };

const tone: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-900",
  UNPAID: "bg-red-100 text-red-900",
  WAIVED: "bg-muted text-muted-foreground",
};

export default function MyDuesPage() {
  const [rows, setRows] = useState<Invoice[]>([]);
  useEffect(() => { api<{ invoices: Invoice[] }>("/me/dues").then((data) => setRows(data.invoices)).catch(() => undefined); }, []);

  const open = rows.filter((row) => row.status === "UNPAID");
  const paid = rows.filter((row) => row.status !== "UNPAID");
  const currency = rows[0]?.currency || "INR";
  const owed = open.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div>
      <PageIntro title="Dues" lede="Membership fees for each club you belong to." />

      <Card className={`p-4 ${open.length ? "border-red-200" : ""}`}>
        <p className="text-sm text-muted-foreground">{open.length ? "Amount due" : "All settled"}</p>
        <p className={`font-serif text-3xl ${open.length ? "text-red-700" : ""}`}>{open.length ? money(owed, currency) : money(0, currency)}</p>
        <p className="text-xs text-muted-foreground">{open.length ? `${open.length} unpaid invoice${open.length === 1 ? "" : "s"}. Your Club Admin or headquarters records the payment.` : "No payment is pending."}</p>
      </Card>

      {open.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-serif text-2xl">Open</h2>
          <div className="flex flex-col gap-2">{open.map((row) => <Row key={row.id} row={row} />)}</div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 font-serif text-2xl">History</h2>
        {paid.length === 0 && <Card className="p-4 text-sm text-muted-foreground">Paid and waived invoices will appear here.</Card>}
        <div className="flex flex-col gap-2">{paid.map((row) => <Row key={row.id} row={row} />)}</div>
      </section>
    </div>
  );
}

function Row({ row }: { row: Invoice }) {
  return (
    <Card className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="truncate font-medium">{row.club.name}</p>
        <p className="text-sm text-muted-foreground">
          {row.status === "PAID" ? `${row.method ? titleCase(row.method) : "Paid"}${row.paidAt ? ` · ${when(row.paidAt)}` : ""}${row.manualReference ? ` · Ref ${row.manualReference}` : ""}` : row.status === "WAIVED" ? "Fee waived" : row.createdAt ? `Issued ${when(row.createdAt)}` : "Awaiting payment"}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="font-medium">{money(row.amount, row.currency)}</p>
        <Badge className={tone[row.status] || ""}>{titleCase(row.status)}</Badge>
      </div>
    </Card>
  );
}
