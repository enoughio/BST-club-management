"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, api, fileUrl } from "@/lib/api";
import { titleCase, when } from "@/lib/format";
import type { MemberRow } from "@/lib/types";

export default function ClubMembersPage() {
  const clubId = String(useParams().clubId);
  const [members, setMembers] = useState<MemberRow[]>([]);
  function load() { api<{ members: MemberRow[] }>(`/clubs/${clubId}/members`).then((data) => setMembers(data.members)).catch(() => undefined); }
  useEffect(load, [clubId]);

  return (
    <div>
      <PageIntro title="Members" lede="Import people who are already members. New joins use an application." />
      <div className="mb-4 flex flex-col gap-2">
        <Button variant="outline" asChild><a href={fileUrl(`/api/v1/clubs/${clubId}/members/export`)}>Export CSV</a></Button>
        <form className="flex flex-col gap-2" onSubmit={(event) => {
          event.preventDefault();
          const body = new FormData(event.currentTarget);
          api(`/clubs/${clubId}/members/import`, { method: "POST", body }).then(() => { toast.success("Import finished"); load(); }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Import failed"));
        }}>
          <Input name="file" type="file" accept=".csv,text/csv" required />
          <Button type="submit" variant="outline">Import CSV</Button>
        </form>
      </div>
      <div className="flex flex-col gap-3">
        {members.map((row) => (
          <Card key={row.membershipId} className="p-4">
            <Link href={`/members/${row.user.id}`} className="font-medium">{row.user.name}</Link>
            <p className="text-sm text-muted-foreground">{row.user.email} · {row.user.phone || "No phone"}</p>
            <p className="text-sm">{titleCase(row.status)} · joined {when(row.joinedAt)}</p>
            {row.status !== "ACTIVE" && <Button className="mt-3" variant="outline" onClick={() => api(`/clubs/${clubId}/members/${row.user.id}/reinstate`, { method: "POST", body: "{}" }).then(() => toast.success("Reinstatement link sent")).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not reinstate"))}>Send reinstatement link</Button>}
          </Card>
        ))}
      </div>
    </div>
  );
}
