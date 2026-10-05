import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn("flex h-11 w-full rounded-md border bg-card px-3 text-base outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring", className)}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn("flex min-h-28 w-full rounded-md border bg-card px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium", className)} {...props} />;
}

export function Select(props: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn("flex h-11 w-full rounded-md border bg-card px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring", props.className)}
    />
  );
}
