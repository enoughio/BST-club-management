"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";

function ResetForm() {
  const token = useSearchParams().get("token") || "";
  const router = useRouter();
  const [password, setPassword] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
      toast.success("Password updated");
      router.push("/login");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not reset password");
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <Field label="New password"><Input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></Field>
      <Button type="submit">Save password</Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader><CardTitle>Choose a new password</CardTitle></CardHeader>
        <CardContent><Suspense><ResetForm /></Suspense></CardContent>
      </Card>
    </main>
  );
}
