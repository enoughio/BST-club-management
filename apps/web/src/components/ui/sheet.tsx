"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className={cn("fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-auto rounded-t-2xl bg-card p-5 shadow-xl md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-96 md:rounded-none")}>
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="font-serif text-2xl">{title}</Dialog.Title>
            <Dialog.Close className="tap inline-flex items-center justify-center rounded-md hover:bg-muted" aria-label="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
