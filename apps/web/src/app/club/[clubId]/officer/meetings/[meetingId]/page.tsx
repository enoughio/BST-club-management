"use client";

import { useParams } from "next/navigation";
import { MeetingBuilder } from "@/components/meeting-builder";

export default function OfficerMeetingPage() {
  const params = useParams();
  return <MeetingBuilder clubId={String(params.clubId)} meetingId={String(params.meetingId)} canCancel={false} />;
}
