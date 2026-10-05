"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { titleCase } from "@/lib/format";
import type { MemberRow } from "@/lib/types";

export default function OfficerMembersPage() {
  const clubId = String(useParams().clubId);
  const [members, setMembers] = useState<MemberRow[]>([]);
  useEffect(() => { api<{ members: MemberRow[] }>(`/clubs/${clubId}/members`).then((data) => setMembers(data.members)).catch(() => undefined); }, [clubId]);
  return (
    <div>
      <PageIntro title="Members" />
      <div className="flex flex-col gap-3">
        {members.map((row) => (
          <Card key={row.membershipId} className="p-4">
            <Link href={`/members/${row.user.id}`} className="font-medium">{row.user.name}</Link>
            <p className="text-sm text-muted-foreground">{titleCase(row.status)} · {row.user.email}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
