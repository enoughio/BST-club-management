"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";
import { titleCase } from "@/lib/format";

type Removal = { id: string; reason: string; details: string | null; status: string; club: { name: string }; user: { name: string; email: string }; requester: { name: string } };

export default function RemovalsPage() {
  const [rows, setRows] = useState<Removal[]>([]);
  function load() { api<{ removals: Removal[] }>("/removals?status=ALL").then((data) => setRows(data.removals)).catch(() => undefined); }
  useEffect(load, []);

  async function decide(id: string, approved: boolean) {
    try {
      await api(`/removals/${id}/${approved ? "approve" : "reject"}`, { method: "POST", body: "{}" });
      toast.success(approved ? "Membership ended" : "Request rejected");
      load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not decide");
    }
  }

  return (
    <div>
      <PageIntro title="Removal requests" lede="Approving ends one club membership. The account and other clubs stay." />
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <Card key={row.id} className="p-4">
            <p className="font-medium">{row.user.name}</p>
            <p className="text-sm text-muted-foreground">{row.club.name} · {titleCase(row.reason)} · {titleCase(row.status)}</p>
            <p className="text-sm">Requested by {row.requester.name}. {row.details}</p>
            {row.status === "PENDING" && (
              <div className="mt-3 flex gap-2">
                <Button onClick={() => void decide(row.id, true)}>Approve</Button>
                <Button variant="outline" onClick={() => void decide(row.id, false)}>Reject</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
