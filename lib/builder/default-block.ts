import type { BlockType, FormBlock } from "@/lib/forms/schema";
import { randomSuffix } from "@/lib/utils/slug";

/** Palette order in the builder's "add block" menu. */
export const BLOCK_TYPES: readonly BlockType[] = [
  "short_text",
  "long_text",
  "email",
  "number",
  "single_choice",
  "multi_choice",
  "rating",
  "yes_no",
];

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  email: "Email",
  number: "Number",
  single_choice: "Single choice",
  multi_choice: "Multi choice",
  rating: "Rating",
  yes_no: "Yes / No",
};

function defaultOptions() {
  return [
    { id: `o_${randomSuffix()}`, label: "Option 1" },
    { id: `o_${randomSuffix()}`, label: "Option 2" },
  ];
}

/**
 * A freshly-added block, ready to drop into `FormDefinition.blocks`.
 *
 * Ids are short and random (`lib/utils/slug.ts`'s `randomSuffix`), not
 * sequential `q1, q2, ...` --- sequential ids collide the moment a block is
 * deleted and another added, since nothing renumbers the survivors.
 */
export function createDefaultBlock(type: BlockType): FormBlock {
  const base = {
    id: `b_${randomSuffix()}`,
    title: "Untitled question",
    required: false,
  };

  switch (type) {
    case "short_text":
      return { ...base, type, shortText: {} };
    case "long_text":
      return { ...base, type, longText: {} };
    case "email":
      return { ...base, type };
    case "number":
      return { ...base, type, number: {} };
    case "single_choice":
      return { ...base, type, singleChoice: { options: defaultOptions() } };
    case "multi_choice":
      return { ...base, type, multiChoice: { options: defaultOptions() } };
    case "rating":
      return { ...base, type, rating: { max: 5, style: "star" } };
    case "yes_no":
      return { ...base, type };
  }
}

/** Same block, fresh id --- the only thing "duplicate" means for a block. */
export function cloneBlockWithNewId(block: FormBlock): FormBlock {
  return { ...block, id: `b_${randomSuffix()}` };
}
