"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { titleCase } from "@/lib/format";

type Row = { id: string; name: string; email: string; role: string; status: string; memberships: { clubName: string; status: string }[] };

export default function HqMembersPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<Row[]>([]);

  function load(query = q) {
    api<{ users: Row[] }>(`/users?q=${encodeURIComponent(query)}`).then((data) => setUsers(data.users)).catch(() => undefined);
  }
  useEffect(() => { load(""); }, []);

  return (
    <div>
      <PageIntro title="Members" lede="Everyone in the organization." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name or email" />
        <Button variant="outline" onClick={() => load()}>Search</Button>
        <Button asChild><Link href="/hq/members/new">New member</Link></Button>
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {users.map((user) => <MemberCard key={user.id} user={user} onDelete={() => load()} />)}
      </div>
      <div className="hidden overflow-hidden rounded-xl border md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted"><tr><th className="p-3">Name</th><th>Email</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="p-3"><Link href={`/members/${user.id}`}>{user.name}</Link></td>
                <td>{user.email}</td>
                <td>{titleCase(user.status)}</td>
                <td>{user.role !== "SUPER_ADMIN" && <Button variant="destructive" size="sm" onClick={() => remove(user.id, () => load())}>Delete</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MemberCard({ user, onDelete }: { user: Row; onDelete: () => void }) {
  return (
    <Card className="p-4">
      <Link href={`/members/${user.id}`} className="font-medium">{user.name}</Link>
      <p className="text-sm text-muted-foreground">{user.email}</p>
      <p className="text-sm">{user.memberships.map((row) => `${row.clubName} (${titleCase(row.status)})`).join(", ") || "No club"}</p>
      {user.role !== "SUPER_ADMIN" && <Button className="mt-3" variant="destructive" onClick={() => remove(user.id, onDelete)}>Delete account</Button>}
    </Card>
  );
}

function remove(id: string, done: () => void) {
  api(`/users/${id}`, { method: "DELETE" }).then(() => { toast.success("Account deleted"); done(); }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not delete"));
}
