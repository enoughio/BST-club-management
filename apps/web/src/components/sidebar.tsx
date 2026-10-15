"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon?: React.ReactNode };

export function Sidebar({
  title,
  items,
  onLogout,
  primaryCount = 4,
}: {
  title: string;
  items: NavItem[];
  onLogout: () => void;
  primaryCount?: number;
}) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const primary = items.slice(0, primaryCount);
  const rest = items.slice(primaryCount);

  function active(href: string) {
    return pathname === href;
  }

  return (
    <>
      <aside className="hidden border-r bg-card md:flex md:min-h-full md:flex-col md:gap-1 md:p-4">
        <Link href={items[0]?.href || "/"} className="mb-4 font-serif text-2xl text-primary">{title}</Link>
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={cn("rounded-md px-3 py-2 text-sm", active(item.href) ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
            {item.label}
          </Link>
        ))}
        <button className="mt-auto rounded-md px-3 py-2 text-left text-sm hover:bg-muted" onClick={onLogout}>Sign out</button>
      </aside>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-card md:hidden" style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}>
        {primary.map((item) => (
          <Link key={item.href} href={item.href} className={cn("flex min-h-14 flex-col items-center justify-center px-1 text-center text-[11px]", active(item.href) && "text-primary")}>
            {item.icon}
            {item.label}
          </Link>
        ))}
        <button className="flex min-h-14 flex-col items-center justify-center text-[11px]" onClick={() => setMore(true)}>
          <Menu className="h-4 w-4" />
          More
        </button>
      </nav>
      <Sheet open={more} onOpenChange={setMore} title="More">
        <div className="flex flex-col gap-2">
          {rest.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMore(false)} className="tap flex items-center rounded-md px-3 hover:bg-muted">
              {item.label}
            </Link>
          ))}
          <Button variant="outline" onClick={onLogout}>Sign out</Button>
        </div>
      </Sheet>
    </>
  );
}
