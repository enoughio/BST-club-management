"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { when } from "@/lib/format";

type Note = { id: string; title: string; body: string; createdAt: string };

export default function ClubAnnouncementsPage() {
  const clubId = String(useParams().clubId);
  const [rows, setRows] = useState<Note[]>([]);
  function load() { api<{ announcements: Note[] }>(`/clubs/${clubId}/announcements`).then((data) => setRows(data.announcements)).catch(() => undefined); }
  useEffect(load, [clubId]);
  return (
    <div>
      <PageIntro title="Announcements" lede="Members of this club receive the note by email." />
      <form className="mb-5 flex flex-col gap-3" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        api(`/clubs/${clubId}/announcements`, { method: "POST", body: JSON.stringify({ title: form.get("title"), body: form.get("body") }) })
          .then(() => { toast.success("Published"); event.currentTarget.reset(); load(); })
          .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not publish"));
      }}>
        <Field label="Title"><Input name="title" required /></Field>
        <Field label="Message"><Textarea name="body" required /></Field>
        <Button type="submit">Publish</Button>
      </form>
      <div className="flex flex-col gap-3">{rows.map((row) => <Card key={row.id} className="p-4"><p className="font-medium">{row.title}</p><p className="text-sm text-muted-foreground">{when(row.createdAt)}</p><p className="mt-2">{row.body}</p></Card>)}</div>
    </div>
  );
}
