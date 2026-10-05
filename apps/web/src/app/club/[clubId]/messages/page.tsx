"use client";

import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { api } from "@/lib/api";

type Conversation = { id: string; subject: string; club: { id: string; name: string } | null; messages: { body: string; sender: { name: string } }[] };

export default function ClubMessagesPage() {
  const [rows, setRows] = useState<Conversation[]>([]);
  const [open, setOpen] = useState<Conversation | null>(null);
  const [body, setBody] = useState("");
  function load() { api<{ conversations: Conversation[] }>("/conversations").then((data) => setRows(data.conversations)).catch(() => undefined); }
  useEffect(load, []);

  return (
    <div>
      <PageIntro title="Messages" lede="Notes from Headquarters to this club’s admin." />
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <button key={row.id} className="text-left" onClick={() => api<{ conversation: Conversation }>(`/conversations/${row.id}`).then((data) => setOpen(data.conversation))}>
            <Card className="p-4"><p className="font-medium">{row.subject}</p><p className="text-sm text-muted-foreground">{row.club?.name}</p></Card>
          </button>
        ))}
      </div>
      {open && (
        <form className="mt-5 flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); api(`/conversations/${open.id}/messages`, { method: "POST", body: JSON.stringify({ body }) }).then(() => { setBody(""); return api<{ conversation: Conversation }>(`/conversations/${open.id}`); }).then((data) => setOpen(data.conversation)); }}>
          <h2 className="font-serif text-2xl">{open.subject}</h2>
          {open.messages.map((message, index) => <Card key={index} className="p-3"><p className="text-sm text-muted-foreground">{message.sender.name}</p><p>{message.body}</p></Card>)}
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} />
          <Button type="submit">Reply</Button>
        </form>
      )}
    </div>
  );
}
