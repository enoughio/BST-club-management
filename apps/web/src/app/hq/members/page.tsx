"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MemberActions, type HqMember } from "@/components/member-actions";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { titleCase } from "@/lib/format";

const LIMIT = 25;

export default function HqMembersPage() {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [users, setUsers] = useState<HqMember[]>([]);

  function load() {
    api<{ users: HqMember[]; total: number; page: number; pageSize: number }>(`/users?q=${encodeURIComponent(applied)}&page=${page}&limit=${LIMIT}`)
      .then((data) => {
        setUsers(data.users);
        setTotal(data.total);
        setPageSize(data.pageSize || LIMIT);
      })
      .catch(() => undefined);
  }

  useEffect(load, [applied, page]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageIntro title="Members" lede="Everyone in the organization. Actions ask you to confirm before anything changes." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name or email" />
        <Button variant="outline" onClick={() => { setPage(1); setApplied(q); }}>Search</Button>
        <Button asChild><Link href="/hq/members/new">New member</Link></Button>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{total} members</p>
      <div className="flex flex-col gap-3 md:hidden">
        {users.map((user) => <MemberCard key={user.id} user={user} onChanged={load} />)}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Status</th><th className="p-3">Clubs</th><th className="p-3"></th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="p-3"><Link href={`/members/${user.id}`}>{user.name}</Link></td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">{titleCase(user.status)}</td>
                <td className="p-3">{user.memberships.map((row) => `${row.clubName} (${titleCase(row.status)})`).join(", ") || "No club"}</td>
                <td className="p-3"><MemberActions user={user} onChanged={load} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No members on this page.</p>}
      <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
        <p className="text-center text-sm">Page {page} of {pages}</p>
        <Button variant="outline" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</Button>
      </div>
    </div>
  );
}

function MemberCard({ user, onChanged }: { user: HqMember; onChanged: () => void }) {
  return (
    <Card className="p-4">
      <Link href={`/members/${user.id}`} className="font-medium">{user.name}</Link>
      <p className="text-sm text-muted-foreground">{user.email}</p>
      <p className="text-sm">{titleCase(user.status)} · {user.memberships.map((row) => `${row.clubName} (${titleCase(row.status)})`).join(", ") || "No club"}</p>
      <div className="mt-3"><MemberActions user={user} onChanged={onChanged} /></div>
    </Card>
  );
}
