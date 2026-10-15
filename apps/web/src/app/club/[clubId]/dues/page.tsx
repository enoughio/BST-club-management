"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useBusEvent } from "@/components/dashboard-bus";
import { PageIntro } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { money, titleCase, when } from "@/lib/format";

type Invoice = { id: string; amount: number; currency: string; status: string; method: string | null; manualReference: string | null; paidAt: string | null; createdAt?: string; user: { name: string; email: string } };
type Filter = "ALL" | "UNPAID" | "PAID" | "WAIVED";

const tone: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-900",
  UNPAID: "bg-red-100 text-red-900",
  WAIVED: "bg-muted text-muted-foreground",
};

export default function DuesPage() {
  const clubId = String(useParams().clubId);
  const [rows, setRows] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");

  function load() {
    api<{ invoices: Invoice[] }>(`/clubs/${clubId}/dues`).then((data) => setRows(data.invoices)).catch(() => undefined);
  }
  useEffect(load, [clubId]);
  useBusEvent(["members:changed", "club:changed"], load);

  const currency = rows[0]?.currency || "INR";
  const sum = (status: string) => rows.filter((row) => row.status === status).reduce((total, row) => total + row.amount, 0);
  const collected = sum("PAID");
  const outstanding = sum("UNPAID");
  const unpaidCount = rows.filter((row) => row.status === "UNPAID").length;
  const paidRatio = rows.length ? Math.round((rows.filter((row) => row.status === "PAID").length / rows.filter((row) => row.status !== "WAIVED").length || 0) * 100) : 0;

  const shown = useMemo(() => rows.filter((row) => {
    if (filter !== "ALL" && row.status !== filter) return false;
    if (query) {
      const hay = `${row.user.name} ${row.user.email} ${row.manualReference || ""}`.toLowerCase();
      if (!hay.includes(query.toLowerCase())) return false;
    }
    return true;
  }), [filter, query, rows]);

  function exportCsv() {
    const lines = ["member,email,amount,currency,status,method,reference,paid_at", ...shown.map((row) => [row.user.name, row.user.email, (row.amount / 100).toFixed(2), row.currency, row.status, row.method || "", row.manualReference || "", row.paidAt || ""].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dues-${filter.toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageIntro title="Dues" lede="New members pay on the application page. Headquarters records manual payments." actions={<Button variant="outline" onClick={exportCsv} disabled={shown.length === 0}>Export CSV</Button>} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Collected" value={money(collected, currency)} hint="Total of paid invoices" />
        <Stat label="Outstanding" value={money(outstanding, currency)} hint={`${unpaidCount} unpaid invoice${unpaidCount === 1 ? "" : "s"}`} warn={unpaidCount > 0} />
        <Stat label="Paid rate" value={`${paidRatio}%`} hint="Paid share of payable invoices" />
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["ALL", "UNPAID", "PAID", "WAIVED"] as Filter[]).map((value) => (
            <button key={value} type="button" className={`rounded-full border px-3 py-1 text-sm ${filter === value ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => setFilter(value)}>
              {value === "ALL" ? "All" : titleCase(value)}{value !== "ALL" && <span className="ml-1 text-xs opacity-70">{rows.filter((row) => row.status === value).length}</span>}
            </button>
          ))}
        </div>
        <Input className="sm:max-w-xs" placeholder="Search name, email, or reference" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border bg-card">
        <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-3 border-b bg-muted/60 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
          <span>Member</span><span>Amount</span><span>Status</span><span>Payment</span>
        </div>
        {shown.length === 0 && <p className="p-4 text-sm text-muted-foreground">{rows.length === 0 ? "No invoices yet." : "No invoices match this filter."}</p>}
        {shown.map((row) => (
          <div key={row.id} className="grid gap-2 border-b px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)] md:items-center md:gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{row.user.name}</p>
              <p className="truncate text-sm text-muted-foreground">{row.user.email}</p>
            </div>
            <p className="font-medium">{money(row.amount, row.currency)}</p>
            <div><Badge className={tone[row.status] || ""}>{titleCase(row.status)}</Badge></div>
            <p className="text-sm text-muted-foreground">
              {row.status === "PAID" ? `${row.method ? titleCase(row.method) : "Paid"}${row.paidAt ? ` · ${when(row.paidAt)}` : ""}${row.manualReference ? ` · ${row.manualReference}` : ""}` : row.status === "WAIVED" ? "Fee waived" : "Awaiting payment"}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{shown.length} of {rows.length} invoices</p>
    </div>
  );
}

function Stat({ label, value, hint, warn = false }: { label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <Card className={`p-4 ${warn ? "border-red-200" : ""}`} title={hint}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`font-serif text-3xl ${warn ? "text-red-700" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}
