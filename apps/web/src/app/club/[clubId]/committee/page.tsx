"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDashboardBus } from "@/components/dashboard-bus";
import { PageIntro } from "@/components/shell";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { titleCase, when } from "@/lib/format";
import { TITLES, type MemberRow } from "@/lib/types";

type Officer = { id: string; title: string; startedAt?: string; endedAt?: string | null; user: { id: string; name: string; email?: string; avatarUrl?: string | null } };
type Term = { key: string; startedAt: string; endedAt: string | null; officers: Officer[] };

export default function ClubCommitteePage() {
  const clubId = String(useParams().clubId);
  const { emit } = useDashboardBus();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [current, setCurrent] = useState<Officer[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState<string>(TITLES[0]);
  const [addUser, setAddUser] = useState("");
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const [termPage, setTermPage] = useState(0);

  function load() {
    Promise.all([
      api<{ officers: Officer[] }>(`/clubs/${clubId}/officers?scope=current`),
      api<{ terms: Term[] }>(`/clubs/${clubId}/officers?scope=past`),
      api<{ members: MemberRow[] }>(`/clubs/${clubId}/members`),
    ]).then(([now, past, people]) => {
      setCurrent(now.officers);
      setTerms(past.terms);
      setOpenTerm(past.terms[0]?.key || null);
      setMembers(people.members.filter((row) => row.status === "ACTIVE"));
      const next: Record<string, string> = {};
      for (const officer of now.officers) next[officer.title] = officer.user.id;
      setDraft(next);
    }).catch(() => undefined);
  }
  useEffect(load, [clubId]);

  const overlaps = useMemo(() => terms.some((term, index) => terms.some((other, otherIndex) => {
    if (index === otherIndex) return false;
    const start = new Date(term.startedAt).getTime();
    const end = term.endedAt ? new Date(term.endedAt).getTime() : Date.now();
    const otherStart = new Date(other.startedAt).getTime();
    const otherEnd = other.endedAt ? new Date(other.endedAt).getTime() : Date.now();
    return start < otherEnd && otherStart < end;
  })), [terms]);

  function save(next: Record<string, string>) {
    api(`/clubs/${clubId}/officers`, { method: "PUT", body: JSON.stringify({ officers: TITLES.map((title) => ({ title, userId: next[title] || null })) }) })
      .then(() => { toast.success("Committee updated and members emailed"); setPending(null); setAddOpen(false); load(); emit("committee:changed"); })
      .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save"));
  }

  function describe(title: string, userId: string) {
    const from = current.find((officer) => officer.title === title)?.user.name || "Vacant";
    const to = members.find((member) => member.user.id === userId)?.user.name || "Vacant";
    return `Replace ${titleCase(title)} from ${from} to ${to}`;
  }

  const pageSize = 3;
  const visibleTerms = terms.slice(termPage * pageSize, termPage * pageSize + pageSize);

  function exportTerm(term: Term, kind: "csv" | "print") {
    const lines = ["designation,name", ...term.officers.map((officer) => `${titleCase(officer.title)},${officer.user.name}`)];
    if (kind === "csv") {
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `committee-${term.startedAt.slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.write(`<h1>Committee ${when(term.startedAt)} – ${when(term.endedAt)}</h1><table>${term.officers.map((officer) => `<tr><td>${titleCase(officer.title)}</td><td>${officer.user.name}</td></tr>`).join("")}</table>`);
    popup.print();
  }

  return (
    <div>
      <PageIntro title="Current committee" lede="Present leadership team" />
      {overlaps && <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">Two recorded terms overlap. Check the dates before the next election.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {TITLES.map((title) => {
          const officer = current.find((row) => row.title === title);
          const showEmail = title === "PRESIDENT";
          return (
            <Card key={title} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{titleCase(title)}</p>
                <p className="mt-1 truncate font-medium">{officer?.user.name || "Vacant"}</p>
                <p className="truncate text-sm text-muted-foreground">{showEmail ? officer?.user.email || "—" : "Email kept private"}</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="icon" aria-label={`Edit ${titleCase(title)}`} onClick={() => setPending(title)}><Pencil className="h-4 w-4" /></Button>
                  {officer && <Button variant="outline" size="icon" aria-label={`Remove ${titleCase(title)}`} onClick={() => setPending(`remove:${title}`)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
              <Avatar name={officer?.user.name} src={officer?.user.avatarUrl} size="lg" />
            </Card>
          );
        })}
        <button type="button" className="rounded-xl border border-dashed p-4 text-left" onClick={() => setAddOpen(true)}>Add member</button>
      </div>

      <h2 className="mb-3 mt-8 font-serif text-2xl">Past terms</h2>
      {terms.length === 0 && <p className="text-sm text-muted-foreground">The first completed term will appear here after the next election.</p>}
      <div className="flex flex-col gap-3">
        {visibleTerms.map((term) => (
          <Card key={term.key} className="p-4">
            <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpenTerm(openTerm === term.key ? null : term.key)}>
              <span>{when(term.startedAt)} – {when(term.endedAt)}</span>
              <span className="text-sm text-muted-foreground">{term.officers.length} officers</span>
            </button>
            {openTerm === term.key && (
              <div className="mt-3">
                {term.officers.map((officer) => (
                  <div key={officer.id} className="flex items-center justify-between gap-3 border-t py-2 text-sm">
                    <span className="text-muted-foreground">{titleCase(officer.title)}</span>
                    <span className="flex items-center gap-2">
                      {officer.user.name}
                      <Avatar name={officer.user.name} src={officer.user.avatarUrl} size="sm" />
                    </span>
                  </div>
                ))}
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" onClick={() => exportTerm(term, "csv")}>CSV</Button>
                  <Button variant="outline" onClick={() => exportTerm(term, "print")}>PDF</Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
      {terms.length > pageSize && (
        <div className="mt-3 flex gap-2">
          <Button variant="outline" disabled={termPage === 0} onClick={() => setTermPage(termPage - 1)}>Previous</Button>
          <Button variant="outline" disabled={(termPage + 1) * pageSize >= terms.length} onClick={() => setTermPage(termPage + 1)}>Next</Button>
        </div>
      )}

      <ConfirmDialog open={Boolean(pending)} onOpenChange={(open) => { if (!open) setPending(null); }} title="Confirm committee change" description={pending?.startsWith("remove:") ? describe(pending.slice(7), "") : pending ? describe(pending, draft[pending] || "") : ""} confirmLabel="Confirm" onConfirm={() => {
        if (!pending) return;
        const title = pending.startsWith("remove:") ? pending.slice(7) : pending;
        const next = { ...draft, [title]: pending.startsWith("remove:") ? "" : draft[title] || "" };
        if (!pending.startsWith("remove:") && !next[title]) { toast.error("Choose a member"); return; }
        save(next);
      }}>
        {pending && !pending.startsWith("remove:") && (
          <Select value={draft[pending] || ""} onChange={(event) => setDraft({ ...draft, [pending]: event.target.value })}>
            <option value="">Vacant</option>
            {members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name}</option>)}
          </Select>
        )}
      </ConfirmDialog>

      <ConfirmDialog open={addOpen} onOpenChange={setAddOpen} title="Add a committee member" description="Designations use the standard officer titles, so spelling stays consistent." confirmLabel="Add" onConfirm={() => save({ ...draft, [addTitle]: addUser })}>
        <Select value={addTitle} onChange={(event) => setAddTitle(event.target.value)}>
          {TITLES.map((title) => <option key={title} value={title}>{titleCase(title)}</option>)}
        </Select>
        <Select value={addUser} onChange={(event) => setAddUser(event.target.value)}>
          <option value="">Choose a member</option>
          {members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name}</option>)}
        </Select>
      </ConfirmDialog>
    </div>
  );
}
