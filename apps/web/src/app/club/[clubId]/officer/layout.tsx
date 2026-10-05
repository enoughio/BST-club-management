"use client";

import { useParams } from "next/navigation";
import { AppFrame, Guard } from "@/components/shell";

export default function OfficerLayout({ children }: { children: React.ReactNode }) {
  const clubId = String(useParams().clubId);
  const items = [
    { href: `/club/${clubId}/officer`, label: "Meetings" },
    { href: `/club/${clubId}/officer/members`, label: "Members" },
    { href: `/club/${clubId}/officer/activity`, label: "Activity" },
  ];
  return (
    <Guard allow={(user) => user.offices.some((office) => office.clubId === clubId) || user.adminClubs.some((club) => club.clubId === clubId)}>
      <AppFrame title="Officer" items={items} primaryCount={3}>{children}</AppFrame>
    </Guard>
  );
}
