"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { titleCase } from "@/lib/format";
import type { MemberRow } from "@/lib/types";

type Removal = { id: string; reason: string; status: string; details: string | null; user: { name: string } };

export default function ClubRemovalsPage() {
  const clubId = String(useParams().clubId);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("RESIGNATION");
  const [details, setDetails] = useState("");
  const [rows, setRows] = useState<Removal[]>([]);

  function load() {
    api<{ members: MemberRow[] }>(`/clubs/${clubId}/members`).then((data) => setMembers(data.members.filter((row) => row.status === "ACTIVE"))).catch(() => undefined);
    api<{ removals: Removal[] }>(`/clubs/${clubId}/removals`).then((data) => setRows(data.removals)).catch(() => undefined);
  }
  useEffect(load, [clubId]);

  return (
    <div>
      <PageIntro title="Removals" lede="A request ends one membership after Headquarters approves it." />
      <form className="mb-6 flex flex-col gap-3" onSubmit={(event) => {
        event.preventDefault();
        api(`/clubs/${clubId}/removals`, { method: "POST", body: JSON.stringify({ userId, reason, details }) })
          .then(() => { toast.success("Request sent"); load(); })
          .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not request removal"));
      }}>
        <Field label="Member">
          <Select value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="">Choose</option>
            {members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name}</option>)}
          </Select>
        </Field>
        <Field label="Reason">
          <Select value={reason} onChange={(event) => setReason(event.target.value)}>
            <option value="RESIGNATION">Resignation</option>
            <option value="DUES_UNPAID">Dues unpaid</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Details"><Textarea value={details} onChange={(event) => setDetails(event.target.value)} /></Field>
        <Button type="submit">Submit request</Button>
      </form>
      <div className="flex flex-col gap-3">
        {rows.map((row) => <Card key={row.id} className="p-4"><p className="font-medium">{row.user.name}</p><p className="text-sm">{titleCase(row.reason)} · {titleCase(row.status)}</p><p className="text-sm">{row.details}</p></Card>)}
      </div>
    </div>
  );
}
