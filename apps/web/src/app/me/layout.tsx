"use client";

import { Award, BookOpen, CalendarDays, IdCard, LayoutDashboard, User } from "lucide-react";
import { AppFrame, Guard } from "@/components/shell";

const icon = "h-4 w-4";
const items = [
  { href: "/me", label: "Dashboard", icon: <LayoutDashboard className={icon} /> },
  { href: "/me/profile", label: "Profile", icon: <User className={icon} /> },
  { href: "/me/dues", label: "Membership", icon: <IdCard className={icon} /> },
  { href: "/me/meetings", label: "Meetings", icon: <CalendarDays className={icon} /> },
  { href: "/me/projects", label: "Projects", icon: <BookOpen className={icon} /> },
  { href: "/me/certificates", label: "Certificates", icon: <Award className={icon} /> },
];

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return (
    <Guard allow={() => true}>
      <AppFrame title="My club" items={items} nav="drawer" theme="member">{children}</AppFrame>
    </Guard>
  );
}
