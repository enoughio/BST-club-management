"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { homeFor, type SessionUser } from "@/lib/types";

function InviteForm() {
  const token = useSearchParams().get("token") || "";
  const router = useRouter();
  const { refresh } = useSession();
  const [password, setPassword] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const data = await api<{ user: SessionUser }>("/auth/accept-invite", { method: "POST", body: JSON.stringify({ token, password }) });
      await refresh();
      toast.success("Password saved");
      router.push(homeFor(data.user));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Invite link failed");
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <Field label="Password"><Input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></Field>
      <Button type="submit">Activate account</Button>
    </form>
  );
}

export default function AcceptInvitePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader><CardTitle>Set your password</CardTitle></CardHeader>
        <CardContent><Suspense><InviteForm /></Suspense></CardContent>
      </Card>
    </main>
  );
}
