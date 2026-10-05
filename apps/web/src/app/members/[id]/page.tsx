"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, fileUrl } from "@/lib/api";

type PublicMember = {
  name: string;
  city: string | null;
  occupation: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  clubs: { id: string; name: string; slug: string }[];
};

export default function MemberPage() {
  const id = String(useParams().id);
  const [member, setMember] = useState<PublicMember | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ member: PublicMember }>(`/directory/members/${id}`).then((data) => setMember(data.member)).catch(() => setError("Member not found"));
  }, [id]);

  if (error) return <main className="p-8">{error}</main>;
  if (!member) return <main className="p-8">Loading…</main>;

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      {member.avatarUrl && <img src={fileUrl(member.avatarUrl)} alt="" className="mb-4 h-20 w-20 rounded-full object-cover" />}
      <h1 className="font-serif text-4xl">{member.name}</h1>
      <p className="text-muted-foreground">{[member.city, member.occupation].filter(Boolean).join(" · ")}</p>
      {member.email && <p className="mt-3">{member.email}</p>}
      {member.phone && <p>{member.phone}</p>}
      <ul className="mt-6 flex flex-col gap-2">
        {member.clubs.map((club) => <li key={club.id} className="rounded-lg border bg-card p-3">{club.name}</li>)}
      </ul>
    </main>
  );
}
