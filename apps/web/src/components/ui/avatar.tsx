import { fileUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

const sizes = { sm: "h-10 w-10 text-base", md: "h-14 w-14 text-xl", lg: "h-20 w-20 text-2xl" };

export function Avatar({ name, src, size = "md", className }: { name?: string | null; src?: string | null; size?: keyof typeof sizes; className?: string }) {
  const initial = (name || "?").trim().slice(0, 1).toUpperCase();
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-muted font-serif text-muted-foreground shadow-sm ring-1 ring-border", sizes[size], className)} aria-hidden={!src}>
      {src ? <img src={src.startsWith("http") ? src : fileUrl(src)} alt={name || ""} className="h-full w-full object-cover" /> : initial}
    </span>
  );
}
