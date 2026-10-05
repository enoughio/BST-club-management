"use client";

import { Bell, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { homeFor, type SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon?: React.ReactNode };

export function Guard({ allow, children }: { allow: (user: SessionUser) => boolean; children: React.ReactNode }) {
  const { user, loading } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allow(user)) router.replace(homeFor(user));
  }, [allow, loading, router, user]);
  if (loading || !user || !allow(user)) return <p className="p-6 text-muted-foreground">Loading…</p>;
  return <>{children}</>;
}

export function AppFrame({
  title,
  items,
  primaryCount = 4,
  children,
}: {
  title: string;
  items: NavItem[];
  primaryCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, refresh } = useSession();
  const [more, setMore] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<{ id: string; title: string; body: string; readAt: string | null; link: string | null }[]>([]);
  const primary = items.slice(0, primaryCount);
  const rest = items.slice(primaryCount);

  useEffect(() => {
    api<{ notifications: typeof notes }>("/notifications")
      .then((data) => setNotes(data.notifications))
      .catch(() => undefined);
  }, [pathname]);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    await refresh();
    router.push("/login");
  }

  function active(href: string) {
    return pathname === href;
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r bg-card md:flex md:flex-col md:gap-1 md:p-4">
        <Link href={items[0]?.href || "/"} className="mb-4 font-serif text-2xl text-primary">{title}</Link>
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={cn("rounded-md px-3 py-2 text-sm", active(item.href) ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
            {item.label}
          </Link>
        ))}
        <button className="mt-auto rounded-md px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => void logout()}>Sign out</button>
      </aside>
      <div className="pb-24 md:pb-8">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
          <div>
            <p className="font-serif text-lg leading-none">{title}</p>
            <p className="text-xs text-muted-foreground">{user?.name}</p>
          </div>
          <Button variant="outline" size="icon" aria-label="Notifications" onClick={() => setNotesOpen(true)}>
            <Bell className="h-4 w-4" />
          </Button>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-5">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-card md:hidden" style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}>
        {primary.map((item) => (
          <Link key={item.href} href={item.href} className={cn("flex min-h-14 flex-col items-center justify-center text-[11px]", active(item.href) && "text-primary")}>
            {item.icon}
            {item.label}
          </Link>
        ))}
        <button className="flex min-h-14 flex-col items-center justify-center text-[11px]" onClick={() => setMore(true)}>
          <Menu className="h-4 w-4" />
          More
        </button>
      </nav>
      <Sheet open={more} onOpenChange={setMore} title="More">
        <div className="flex flex-col gap-2">
          {rest.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMore(false)} className="tap flex items-center rounded-md px-3 hover:bg-muted">
              {item.label}
            </Link>
          ))}
          <Button variant="outline" onClick={() => void logout()}>Sign out</Button>
        </div>
      </Sheet>
      <Sheet open={notesOpen} onOpenChange={setNotesOpen} title="Notifications">
        <div className="flex flex-col gap-3">
          {notes.length === 0 && <p className="text-sm text-muted-foreground">No notifications yet.</p>}
          {notes.map((note) => (
            <button
              key={note.id}
              className="rounded-lg border p-3 text-left"
              onClick={() => {
                void api(`/notifications/${note.id}/read`, { method: "POST" });
                if (note.link) router.push(note.link);
                setNotesOpen(false);
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{note.title}</p>
                {!note.readAt && <Badge>New</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{note.body}</p>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

export function PageIntro({ title, lede }: { title: string; lede?: string }) {
  return (
    <div className="mb-5">
      <h1 className="font-serif text-3xl tracking-tight">{title}</h1>
      {lede && <p className="mt-1 text-muted-foreground">{lede}</p>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
