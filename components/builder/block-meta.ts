import {
  AlignLeftIcon,
  CircleDotIcon,
  HashIcon,
  ListChecksIcon,
  MailIcon,
  StarIcon,
  ToggleLeftIcon,
  TypeIcon,
  type LucideIcon,
} from "lucide-react";

import type { BlockType } from "@/lib/forms/schema";

export const BLOCK_TYPE_ICONS: Record<BlockType, LucideIcon> = {
  short_text: TypeIcon,
  long_text: AlignLeftIcon,
  email: MailIcon,
  number: HashIcon,
  single_choice: CircleDotIcon,
  multi_choice: ListChecksIcon,
  rating: StarIcon,
  yes_no: ToggleLeftIcon,
};
