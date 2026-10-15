"use client";

import { useParams } from "next/navigation";
import { ActivityPanel } from "@/components/activity-panel";

export default function ClubAnnouncementsPage() {
  const clubId = String(useParams().clubId);
  return (
    <div className="lg:hidden">
      <ActivityPanel clubId={clubId} />
    </div>
  );
}
