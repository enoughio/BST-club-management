"use client";

import { Bell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDashboardBus } from "@/components/dashboard-bus";
import { Sidebar, type NavItem } from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { homeFor, type SessionUser } from "@/lib/types";

export type { NavItem };

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

/**
 * Three independent panels side by side on desktop, stacked on mobile.
 * Each panel scrolls on its own; they talk only through the dashboard bus.
 *
 *   [ Sidebar 240px ] [ Main content, flexible ] [ Activity rail 320px, optional ]
 */
export function AppFrame({
  title,
  items,
  primaryCount = 4,
  rail,
  onAlerts,
  children,
}: {
  title: string;
  items: NavItem[];
  primaryCount?: number;
  rail?: React.ReactNode;
  onAlerts?: () => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, refresh } = useSession();
  const { alertCount } = useDashboardBus();
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<{ id: string; title: string; body: string; readAt: string | null; link: string | null }[]>([]);

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

  return (
    <div className="flex min-h-screen flex-col md:h-screen md:flex-row md:overflow-hidden">
      <div className="w-full flex-none md:h-full md:w-60 md:overflow-y-auto">
        <Sidebar title={title} items={items} primaryCount={primaryCount} onLogout={() => void logout()} />
      </div>

      <div className="flex min-w-0 flex-grow flex-col pb-24 md:h-full md:pb-0">
        <header className="sticky top-0 z-30 flex flex-none items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur md:static">
          <div>
            <p className="font-serif text-lg leading-none">{title}</p>
            <p className="text-xs text-muted-foreground">{user?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {onAlerts && (
              <Button variant="outline" size="icon" className="relative lg:hidden" aria-label="Activity and alerts" onClick={onAlerts}>
                <Bell className="h-4 w-4" />
                {alertCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />}
              </Button>
            )}
            <Button variant="outline" size="icon" aria-label="Notifications" onClick={() => setNotesOpen(true)}>
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="w-full flex-grow px-4 py-5 md:overflow-y-auto md:px-6">{children}</main>
      </div>

      {rail && <aside className="hidden w-80 flex-none border-l bg-card lg:block lg:h-full lg:overflow-y-auto">{rail}</aside>}

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

export function PageIntro({ title, lede, actions }: { title: string; lede?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">{title}</h1>
        {lede && <p className="mt-1 text-muted-foreground">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
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
