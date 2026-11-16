"use client";

import { Eye } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ActivityPanel } from "@/components/activity-panel";
import { DashboardProvider } from "@/components/dashboard-bus";
import { AppFrame, Guard } from "@/components/shell";
import { useSession } from "@/lib/session";

export default function ClubLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const clubId = String(useParams().clubId);
  const { user } = useSession();
  const [alertsOpen, setAlertsOpen] = useState(false);
  useEffect(() => {
    if (!alertsOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setAlertsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [alertsOpen]);
  if (pathname.includes("/officer")) return <>{children}</>;
  const items = [
    { href: `/club/${clubId}`, label: "Overview" },
    { href: `/club/${clubId}/members`, label: "Members" },
    { href: `/club/${clubId}/meetings`, label: "Meetings" },
    { href: `/club/${clubId}/committee`, label: "Committee" },
    { href: `/club/${clubId}/applications`, label: "Applications" },
    { href: `/club/${clubId}/removals`, label: "Removals" },
    { href: `/club/${clubId}/profile`, label: "Profile" },
    { href: `/club/${clubId}/dues`, label: "Dues" },
    { href: `/club/${clubId}/messages`, label: "Messages" },
  ];
  const preview = user?.role === "SUPER_ADMIN" && !user.adminClubs.some((club) => club.clubId === clubId);
  return (
    <Guard allow={(me) => me.role === "SUPER_ADMIN" || me.adminClubs.some((club) => club.clubId === clubId)}>
      <DashboardProvider>
        <AppFrame title="Club" items={items} theme="admin" alertsOpen={alertsOpen} onAlerts={() => setAlertsOpen((open) => !open)}>
          {preview && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <span className="flex items-center gap-2"><Eye className="h-4 w-4" /> Viewing as Club Admin (headquarters preview). Changes you make here are real.</span>
              <Link href={`/hq/clubs/${clubId}`} className="font-medium underline">Back to HQ view</Link>
            </div>
          )}
          {children}
        </AppFrame>
        <aside
          id="club-activity-alerts"
          aria-label="Activity and alerts"
          aria-hidden={!alertsOpen}
          inert={!alertsOpen}
          className={alertsOpen ? "fixed bottom-14 right-0 top-16 z-20 w-full max-w-md overflow-auto border-l bg-card shadow-xl md:bottom-0" : "hidden"}
        >
          <ActivityPanel clubId={clubId} />
        </aside>
      </DashboardProvider>
    </Guard>
  );
}
