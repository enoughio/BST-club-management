"use client";

import { AppFrame, Guard } from "@/components/shell";

const items = [
  { href: "/hq", label: "Overview" },
  { href: "/hq/clubs", label: "Clubs" },
  { href: "/hq/members", label: "Members" },
  { href: "/hq/removals", label: "Removals" },
  { href: "/hq/curriculum", label: "Curriculum" },
  { href: "/hq/announcements", label: "Announcements" },
  { href: "/hq/messages", label: "Messages" },
  { href: "/hq/reports", label: "Reports" },
  { href: "/hq/settings", label: "Settings" },
];

export default function HqLayout({ children }: { children: React.ReactNode }) {
  return (
    <Guard allow={(user) => user.role === "SUPER_ADMIN"}>
      <AppFrame title="Headquarters" items={items}>{children}</AppFrame>
    </Guard>
  );
}
