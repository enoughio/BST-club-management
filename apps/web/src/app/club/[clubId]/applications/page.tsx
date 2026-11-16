"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { when } from "@/lib/format";

type SentInvite = {
  url?: string;
  email?: string;
  kind?: string;
  clubName?: string;
  expiresAt?: string;
  application?: { email?: string; kind?: string; expiresAt?: string; url?: string; clubName?: string };
};

type Sent = {
  email: string;
  kind: "NEW" | "REINSTATE";
  clubName: string;
  expiresAt: string | null;
  url: string;
};

export default function ApplicationsPage() {
  const clubId = String(useParams().clubId);
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState("NEW");
  const [clubName, setClubName] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);

  useEffect(() => {
    api<{ club: { name: string } }>(`/clubs/${clubId}`).then((data) => setClubName(data.club.name)).catch(() => undefined);
  }, [clubId]);

  async function send() {
    setPending(true);
    try {
      const data = await api<SentInvite>(`/clubs/${clubId}/applications`, { method: "POST", body: JSON.stringify({ email, kind }) });
      const application = data.application;
      const nextKind = application?.kind || data.kind || kind;
      setSent({
        email: application?.email || data.email || email,
        kind: nextKind === "REINSTATE" ? "REINSTATE" : "NEW",
        clubName: data.clubName || application?.clubName || clubName || "this club",
        expiresAt: application?.expiresAt || data.expiresAt || null,
        url: application?.url || data.url || "",
      });
      setConfirm(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not start application");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div>
        <PageIntro title="Registration email sent" lede={sent.kind === "REINSTATE" ? "Reinstatement" : "New join"} />
        <Card className="flex flex-col gap-2 p-5 text-sm">
          <p><span className="text-muted-foreground">Recipient. </span>{sent.email}</p>
          <p><span className="text-muted-foreground">Kind. </span>{sent.kind === "REINSTATE" ? "Reinstatement" : "New join"}</p>
          <p><span className="text-muted-foreground">Club. </span>{sent.clubName}</p>
          <p><span className="text-muted-foreground">Expires. </span>{when(sent.expiresAt)}</p>
          <p>The registration email was sent.</p>
          <p className="break-all"><span className="text-muted-foreground">Link. </span>{sent.url || "The link was not included in the response."}</p>
          <Button className="mt-3" type="button" onClick={() => setSent(null)}>Send another</Button>
        </Card>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); setConfirm(true); }}>
      <PageIntro title="Applications" lede="Enter an email. The person gets one page with the form and Razorpay together." />
      <Field label="Email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
      <Field label="Kind">
        <Select value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="NEW">New join</option>
          <option value="REINSTATE">Reinstatement</option>
        </Select>
      </Field>
      <Button type="submit">Send the link</Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        pending={pending}
        title="Send this application?"
        description={`Email ${email || "this person"} a ${kind === "NEW" ? "new membership" : "reinstatement"} link.`}
        confirmLabel="Send"
        onConfirm={() => void send()}
      />
    </form>
  );
}
