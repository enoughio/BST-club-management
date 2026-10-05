"use client";

import { useParams, usePathname } from "next/navigation";
import { AppFrame, Guard } from "@/components/shell";

export default function ClubLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const clubId = String(useParams().clubId);
  if (pathname.includes("/officer")) return <>{children}</>;
  const items = [
    { href: `/club/${clubId}`, label: "Home" },
    { href: `/club/${clubId}/members`, label: "Members" },
    { href: `/club/${clubId}/meetings`, label: "Meetings" },
    { href: `/club/${clubId}/committee`, label: "Committee" },
    { href: `/club/${clubId}/applications`, label: "Applications" },
    { href: `/club/${clubId}/removals`, label: "Removals" },
    { href: `/club/${clubId}/profile`, label: "Profile" },
    { href: `/club/${clubId}/elections`, label: "Elections" },
    { href: `/club/${clubId}/announcements`, label: "Announcements" },
    { href: `/club/${clubId}/dues`, label: "Dues" },
    { href: `/club/${clubId}/messages`, label: "Messages" },
  ];
  return (
    <Guard allow={(user) => user.adminClubs.some((club) => club.clubId === clubId)}>
      <AppFrame title="Club" items={items}>{children}</AppFrame>
    </Guard>
  );
}
