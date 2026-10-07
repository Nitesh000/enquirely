import { blockSchema } from "@/lib/forms/schema";
import z from "zod";

export const MAX_BLOCKS = 20;
export const MAX_VALIDATION_RETRIES = 2;

export const intentSchema = z.object({
  goal: z.string().describe("What the creator is actually trying to learn"),
  audience: z.string().describe("Who will be answering this"),
  tone: z.enum(["neutral", "friendly", "formal"]),
  targetBlockCount: z.number().int().min(1).max(MAX_BLOCKS),
});

export type Intent = z.infer<typeof intentSchema>;

export const blocksSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  blocks: z.array(blockSchema).min(1).max(MAX_BLOCKS),
});

export const wordingShema = z.object({
  blocks: z
    .array(z.object({ id: z.string(), title: z.string().min(1) }))
    .max(MAX_BLOCKS),
});
