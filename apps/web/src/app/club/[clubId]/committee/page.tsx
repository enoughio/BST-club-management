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

type Officer = { id: string; title: string; user: { id: string; name: string } };
type Term = { key: string; startedAt: string; endedAt: string | null; officers: { id: string; title: string; user: { name: string } }[] };

export default function ClubCommitteePage() {
  const clubId = String(useParams().clubId);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [terms, setTerms] = useState<Term[]>([]);

  function load() {
    Promise.all([
      api<{ officers: Officer[] }>(`/clubs/${clubId}/officers?scope=current`),
      api<{ terms: Term[] }>(`/clubs/${clubId}/officers?scope=past`),
      api<{ members: MemberRow[] }>(`/clubs/${clubId}/members`),
    ]).then(([current, past, people]) => {
      setTerms(past.terms);
      setMembers(people.members.filter((row) => row.status === "ACTIVE"));
      const next: Record<string, string> = {};
      for (const officer of current.officers) next[officer.title] = officer.user.id;
      setDraft(next);
    }).catch(() => undefined);
  }
  useEffect(load, [clubId]);

  return (
    <div>
      <PageIntro title="Committee" lede="Assign titles until an election replaces them. Past terms stay on this page." />
      <div className="flex flex-col gap-3">
        {TITLES.map((title) => (
          <label key={title} className="text-sm font-medium">
            {titleCase(title)}
            <Select className="mt-1" value={draft[title] || ""} onChange={(event) => setDraft({ ...draft, [title]: event.target.value })}>
              <option value="">Vacant</option>
              {members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name}</option>)}
            </Select>
          </label>
        ))}
        <Button onClick={() => api(`/clubs/${clubId}/officers`, { method: "PUT", body: JSON.stringify({ officers: TITLES.map((title) => ({ title, userId: draft[title] || null })) }) }).then(() => { toast.success("Saved"); load(); }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save"))}>Save committee</Button>
      </div>
      <h2 className="mb-3 mt-8 font-serif text-2xl">Past terms</h2>
      <div className="flex flex-col gap-3">
        {terms.map((term) => (
          <Card key={term.key} className="p-4">
            <p className="font-medium">{when(term.startedAt)} – {when(term.endedAt)}</p>
            {term.officers.map((officer) => <p key={officer.id} className="text-sm">{titleCase(officer.title)}: {officer.user.name}</p>)}
          </Card>
        ))}
      </div>
    </div>
  );
}
