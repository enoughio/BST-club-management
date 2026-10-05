"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { when } from "@/lib/format";
import type { Club } from "@/lib/types";

type Note = { id: string; title: string; body: string; scope: string; createdAt: string; club: { name: string } | null };

export default function AnnouncementsPage() {
  const [rows, setRows] = useState<Note[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [scope, setScope] = useState("GLOBAL");
  const [clubId, setClubId] = useState("");

  function load() { api<{ announcements: Note[] }>("/announcements").then((data) => setRows(data.announcements)).catch(() => undefined); }
  useEffect(() => {
    load();
    api<{ clubs: Club[] }>("/clubs").then((data) => { setClubs(data.clubs); setClubId(data.clubs[0]?.id || ""); }).catch(() => undefined);
  }, []);

  return (
    <div>
      <PageIntro title="Announcements" lede="Send a note to every active member, or to one club. Email goes out when it is published." />
      <form className="mb-6 flex flex-col gap-3" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const nextScope = String(form.get("scope") || "GLOBAL");
        const nextClub = String(form.get("clubId") || "");
        api("/announcements", {
          method: "POST",
          body: JSON.stringify({
            title: form.get("title"),
            body: form.get("body"),
            scope: nextScope,
            clubId: nextScope === "CLUB" ? nextClub : undefined,
          }),
        })
          .then(() => { toast.success("Sent"); event.currentTarget.reset(); setScope("GLOBAL"); load(); })
          .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not send"));
      }}>
        <Field label="Audience">
          <Select name="scope" value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value="GLOBAL">Organization-wide (all members)</option>
            <option value="CLUB">One club</option>
          </Select>
        </Field>
        {scope === "CLUB" && (
          <Field label="Club">
            <Select name="clubId" value={clubId} onChange={(event) => setClubId(event.target.value)} required>
              {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Title"><Input name="title" required /></Field>
        <Field label="Message"><Textarea name="body" required /></Field>
        <Button type="submit">Publish</Button>
      </form>
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <Card key={row.id} className="p-4">
            <p className="font-medium">{row.title}</p>
            <p className="text-sm text-muted-foreground">
              {row.scope === "CLUB" ? `Club · ${row.club?.name || "Club"}` : "Organization-wide · All members"} · {when(row.createdAt)}
            </p>
            <p className="mt-2">{row.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
