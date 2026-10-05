"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { homeFor } from "@/lib/types";

export default function HomePage() {
  const { user, loading } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!loading && user) router.replace(homeFor(user));
  }, [loading, router, user]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm uppercase tracking-[0.2em] text-accent">Headquarters · Clubs · Members</p>
      <h1 className="mt-3 font-serif text-5xl leading-tight text-primary">A home for every club, and a clear path for every speaker.</h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Appoint one Club Admin, collect membership fees, run meetings, and keep the executive committee record.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild><Link href="/login">Sign in</Link></Button>
        <Button variant="outline" asChild><Link href="/directory">Find a club</Link></Button>
      </div>
    </main>
  );
}
