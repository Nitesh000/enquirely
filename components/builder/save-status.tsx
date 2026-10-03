"use client";

import { CheckIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react";

import { cn } from "@/lib/utils/utils";

import type { SaveStatus as Status } from "./use-autosave";

export function SaveStatusIndicator({ status }: { status: Status }) {
  if (status === "idle") return null;

  const config: Record<Exclude<Status, "idle">, { label: string; className: string }> = {
    saving: { label: "Saving…", className: "text-muted-foreground" },
    saved: { label: "Saved", className: "text-muted-foreground" },
    error: { label: "Couldn't save --- retrying", className: "text-destructive" },
    conflict: {
      label: "Changed elsewhere --- reload to continue",
      className: "text-destructive",
    },
  };

  const { label, className } = config[status];

  return (
    <span className={cn("flex items-center gap-1.5 text-xs", className)}>
      {status === "saving" ? (
        <Loader2Icon className="size-3 animate-spin" />
      ) : status === "saved" ? (
        <CheckIcon className="size-3" />
      ) : (
        <TriangleAlertIcon className="size-3" />
      )}
      {label}
    </span>
  );
}
