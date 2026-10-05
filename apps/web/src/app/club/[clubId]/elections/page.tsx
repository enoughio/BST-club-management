"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { titleCase, when } from "@/lib/format";
import { TITLES } from "@/lib/types";

type Election = {
  id: string;
  status: string;
  nominationCloses: string;
  votingCloses: string;
  nominations: { id: string; title: string; userId: string; user: { id: string; name: string } }[];
};

export default function ElectionsPage() {
  const clubId = String(useParams().clubId);
  const [rows, setRows] = useState<Election[]>([]);
  const [nextAt, setNextAt] = useState("");
  const [title, setTitle] = useState<string>(TITLES[0]);

  function load() {
    api<{ elections: Election[]; nextElectionAt: string }>(`/clubs/${clubId}/elections`).then((data) => { setRows(data.elections); setNextAt(data.nextElectionAt); }).catch(() => undefined);
  }
  useEffect(load, [clubId]);
  const open = rows.find((row) => row.status === "NOMINATION" || row.status === "VOTING");

  return (
    <div>
      <PageIntro title="Elections" lede={`Next opening ${nextAt ? when(nextAt) : "—"}. The Club Admin seat is never on the ballot.`} />
      {open && (
        <Card className="mb-4 p-4">
          <p className="font-medium">{titleCase(open.status)} until {when(open.status === "NOMINATION" ? open.nominationCloses : open.votingCloses)}</p>
          {open.status === "NOMINATION" && (
            <form className="mt-3 flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); api(`/clubs/${clubId}/elections/${open.id}/nominations`, { method: "POST", body: JSON.stringify({ title }) }).then(() => { toast.success("You are standing"); load(); }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not nominate")); }}>
              <Select value={title} onChange={(event) => setTitle(event.target.value)}>{TITLES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</Select>
              <Button type="submit">Stand for this title</Button>
            </form>
          )}
          {open.status === "VOTING" && TITLES.map((item) => {
            const candidates = open.nominations.filter((nomination) => nomination.title === item);
            if (candidates.length === 0) return null;
            return (
              <div key={item} className="mt-3">
                <p className="text-sm font-medium">{titleCase(item)}</p>
                {candidates.map((candidate) => (
                  <Button key={candidate.id} className="mt-2" variant="outline" onClick={() => api(`/clubs/${clubId}/elections/${open.id}/votes`, { method: "POST", body: JSON.stringify({ title: item, candidateId: candidate.userId }) }).then(() => toast.success("Vote saved")).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not vote"))}>{candidate.user.name}</Button>
                ))}
              </div>
            );
          })}
        </Card>
      )}
      <div className="flex flex-col gap-3">
        {rows.map((row) => <Card key={row.id} className="p-4"><p className="font-medium">{titleCase(row.status)}</p><p className="text-sm text-muted-foreground">{row.nominations.length} nominations</p></Card>)}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No election is open. Headquarters sets the interval.</p>}
      </div>
    </div>
  );
}
