"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { homeFor, type SessionUser } from "@/lib/types";
import { Field } from "@/components/shell";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [email, setEmail] = useState("super@clubportal.local");
  const [password, setPassword] = useState("Demo1234!");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const data = await api<{ user: SessionUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      await refresh();
      router.push(homeFor(data.user));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not sign in");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <p className="text-sm text-muted-foreground">Use a demo account from the README, or the password you set.</p>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <Field label="Email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
            <Field label="Password"><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></Field>
            <Button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
            <Link className="text-sm text-primary" href="/forgot-password">Forgot password</Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
