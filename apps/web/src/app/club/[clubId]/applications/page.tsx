"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";

export default function ApplicationsPage() {
  const clubId = String(useParams().clubId);
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState("NEW");
  const [url, setUrl] = useState("");
  const [confirm, setConfirm] = useState(false);

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
      {url && <p className="break-all text-sm">Link: {url}</p>}
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Send this application?" description={`Email ${email || "this person"} a ${kind === "NEW" ? "new membership" : "reinstatement"} link.`} confirmLabel="Send" onConfirm={() => {
        api<{ url: string }>(`/clubs/${clubId}/applications`, { method: "POST", body: JSON.stringify({ email, kind }) })
          .then((data) => { setUrl(data.url); setConfirm(false); toast.success("Invitation sent"); })
          .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not start application"));
      }} />
    </form>
  );
}
