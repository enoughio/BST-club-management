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
import { TITLES, type MemberRow } from "@/lib/types";

type Officer = { id: string; title: string; startedAt: string; endedAt: string | null; user: { id: string; name: string; email: string } };
type Term = { key: string; startedAt: string; endedAt: string | null; officers: Officer[] };

export default function HqCommitteePage() {
  const clubId = String(useParams().clubId);
  const [current, setCurrent] = useState<Officer[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});

  function load() {
    Promise.all([
      api<{ officers: Officer[] }>(`/clubs/${clubId}/officers?scope=current`),
      api<{ terms: Term[] }>(`/clubs/${clubId}/officers?scope=past`),
      api<{ members: MemberRow[] }>(`/clubs/${clubId}`),
    ]).then(([now, past, club]) => {
      setCurrent(now.officers);
      setTerms(past.terms);
      setMembers(club.members.filter((row) => row.status === "ACTIVE"));
      const next: Record<string, string> = {};
      for (const officer of now.officers) next[officer.title] = officer.user.id;
      setDraft(next);
    }).catch(() => undefined);
  }
  useEffect(load, [clubId]);

  return (
    <div>
      <PageIntro title="Executive committee" lede="The current term, and every previous one." />
      <div className="flex flex-col gap-3">
        {TITLES.map((title) => (
          <Card key={title} className="p-4">
            <p className="text-sm text-muted-foreground">{titleCase(title)}</p>
            <Select value={draft[title] || ""} onChange={(event) => setDraft({ ...draft, [title]: event.target.value })}>
              <option value="">Vacant</option>
              {members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name}</option>)}
            </Select>
          </Card>
        ))}
        <Button onClick={() => api(`/clubs/${clubId}/officers`, { method: "PUT", body: JSON.stringify({ officers: TITLES.map((title) => ({ title, userId: draft[title] || null })) }) }).then(() => { toast.success("Committee saved"); load(); }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save"))}>Save current committee</Button>
      </div>
      <h2 className="mb-3 mt-8 font-serif text-2xl">Past terms</h2>
      <div className="flex flex-col gap-3">
        {terms.map((term) => (
          <Card key={term.key} className="p-4">
            <p className="font-medium">{when(term.startedAt)} – {when(term.endedAt)}</p>
            {term.officers.map((officer) => <p key={officer.id} className="text-sm">{titleCase(officer.title)}: {officer.user.name}</p>)}
          </Card>
        ))}
        {terms.length === 0 && <p className="text-sm text-muted-foreground">No ended terms yet.</p>}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Current holders: {current.map((officer) => officer.user.name).join(", ") || "none"}.</p>
    </div>
  );
}
