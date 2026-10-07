"use client";

import { cn } from "cn";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import { useStore } from "zustand";

import { confirmStore } from "@/lib/ui/confirm-store";

import { Button } from "./button";

export function ConfirmDialog() {
  const pending = useStore(confirmStore, (s) => s.pending);
  const settle = useStore(confirmStore, (s) => s.settle);

  const options = pending?.options;

  return (
    <AlertDialogPrimitive.Root
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
    >
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />

        <AlertDialogPrimitive.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          <div className="flex flex-col gap-1.5">
            <AlertDialogPrimitive.Title className="font-heading text-base font-semibold text-balance">
              {options?.title}
            </AlertDialogPrimitive.Title>

            {options?.description ? (
              <AlertDialogPrimitive.Description className="text-sm text-pretty text-muted-foreground">
                {options.description}
              </AlertDialogPrimitive.Description>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="outline" size="sm">
                {options?.cancelLabel ?? "Cancel"}
              </Button>
            </AlertDialogPrimitive.Cancel>

            <AlertDialogPrimitive.Action asChild onClick={() => settle(true)}>
              <Button
                variant={options?.destructive ? "destructive" : "brand"}
                size="sm"
              >
                {options?.confirmLabel ?? "Confirm"}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
