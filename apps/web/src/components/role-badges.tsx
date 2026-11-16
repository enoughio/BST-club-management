import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";
import { TITLES } from "@/lib/types";

const titleOrder = TITLES as readonly string[];

export function orderedOffices(offices: string[]) {
  return [...offices].sort((a, b) => {
    const left = titleOrder.indexOf(a);
    const right = titleOrder.indexOf(b);
    return (left === -1 ? titleOrder.length : left) - (right === -1 ? titleOrder.length : right);
  });
}

/** Club Admin and current committee titles for one club roster row. */
export function MemberRoleBadges({ offices, isClubAdmin, className }: { offices?: string[]; isClubAdmin?: boolean; className?: string }) {
  const titles = orderedOffices(offices || []);
  if (!isClubAdmin && titles.length === 0) return null;
  return (
    <span className={className ?? "mt-1 flex flex-wrap gap-1"}>
      {isClubAdmin && <Badge className="bg-violet-100 text-violet-950">Club Admin</Badge>}
      {titles.map((title) => (
        <Badge key={title} className="bg-sky-100 text-sky-950">{titleCase(title)}</Badge>
      ))}
    </span>
  );
}
