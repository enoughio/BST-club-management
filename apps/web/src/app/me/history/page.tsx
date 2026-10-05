"use client";

import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { titleCase, when } from "@/lib/format";

type Row = { id: string; status: string; joinedAt: string; endedAt: string | null; club: { name: string; city: string } };

export default function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => { api<{ memberships: Row[] }>("/me/history").then((data) => setRows(data.memberships)).catch(() => undefined); }, []);
  return (
    <div>
      <PageIntro title="Membership history" />
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <Card key={row.id} className="p-4">
            <p className="font-medium">{row.club.name}</p>
            <p className="text-sm text-muted-foreground">{row.club.city} · {titleCase(row.status)}</p>
            <p className="text-sm">Joined {when(row.joinedAt)}{row.endedAt ? ` · ended ${when(row.endedAt)}` : ""}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
