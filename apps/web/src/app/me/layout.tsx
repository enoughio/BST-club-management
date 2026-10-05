"use client";

import { AppFrame, Guard } from "@/components/shell";

const items = [
  { href: "/me", label: "Progress" },
  { href: "/me/meetings", label: "Meetings" },
  { href: "/me/materials", label: "Materials" },
  { href: "/me/dues", label: "Dues" },
  { href: "/me/history", label: "History" },
  { href: "/me/profile", label: "Profile" },
];

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return (
    <Guard allow={() => true}>
      <AppFrame title="My club" items={items}>{children}</AppFrame>
    </Guard>
  );
}
