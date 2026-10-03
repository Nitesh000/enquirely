"use client";

import { PlusIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BLOCK_TYPE_LABELS, BLOCK_TYPES } from "@/lib/builder/default-block";
import type { BlockType } from "@/lib/forms/schema";

import { BLOCK_TYPE_ICONS } from "./block-meta";

export function AddBlockMenu({
  onAdd,
  trigger,
}: {
  onAdd: (type: BlockType) => void;
  /** Defaults to a "New block" button; the empty state passes a bigger CTA. */
  trigger?: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="w-full">
            <PlusIcon />
            Add question
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {BLOCK_TYPES.map((type) => {
          const Icon = BLOCK_TYPE_ICONS[type];
          return (
            <DropdownMenuItem key={type} onSelect={() => onAdd(type)}>
              <Icon className="size-4 text-muted-foreground" />
              {BLOCK_TYPE_LABELS[type]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
