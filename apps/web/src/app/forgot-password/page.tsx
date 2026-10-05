"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
    setSent(true);
    toast.success("If that account exists, a reset email is on its way.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader><CardTitle>Reset password</CardTitle></CardHeader>
        <CardContent>
          {sent ? <p>Check your inbox for the reset link.</p> : (
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <Field label="Email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
              <Button type="submit">Send reset link</Button>
            </form>
          )}
          <Link className="mt-4 inline-block text-sm text-primary" href="/login">Back to sign in</Link>
        </CardContent>
      </Card>
    </main>
  );
}
