"use client";

import type { AnswerValue } from "@/lib/forms/answers";
import type { FormBlock } from "@/lib/forms/schema";

import { EmailBlock } from "./email-block";
import { LongTextBlock } from "./long-text-block";
import { MultiChoiceBlock } from "./multi-choice-block";
import { NumberBlock } from "./number-block";
import { RatingBlock } from "./rating-block";
import { ShortTextBlock } from "./short-text-block";
import { SingleChoiceBlock } from "./single-choice-block";
import { YesNoBlock } from "./yes-no-block";

export type BlockRendererProps = {
  block: FormBlock;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue | undefined) => void;
  onSubmit: () => void;
  autoFocus?: boolean;
  error?: string;
};

/**
 * Block type -> component. The `switch` is exhaustive over
 * `FormBlock["type"]`, so adding a ninth block type to `lib/forms/schema.ts`
 * makes this fail to compile until it has a component --- which is the point.
 */
export function BlockRenderer({ block, ...rest }: BlockRendererProps) {
  switch (block.type) {
    case "short_text":
      return <ShortTextBlock block={block} {...rest} />;
    case "long_text":
      return <LongTextBlock block={block} {...rest} />;
    case "email":
      return <EmailBlock block={block} {...rest} />;
    case "number":
      return <NumberBlock block={block} {...rest} />;
    case "single_choice":
      return <SingleChoiceBlock block={block} {...rest} />;
    case "multi_choice":
      return <MultiChoiceBlock block={block} {...rest} />;
    case "rating":
      return <RatingBlock block={block} {...rest} />;
    case "yes_no":
      return <YesNoBlock block={block} {...rest} />;
  }
}
