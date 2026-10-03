import { FormBlock, FormDefinition, FormTheme, LogicRule } from "./schema";
import { produce } from "immer";

/**
 * operations to perform by the user
 */
export type FormOperation =
  | { type: "update_form"; changes: Partial<Pick<FormDefinition, "title" | "description">> }
  | { type: "add_block"; block: FormBlock; index: number }
  | { type: "update_block"; id: string; changes: Partial<FormBlock> }
  | { type: "delete_block"; id: string }
  | { type: "move_block"; id: string; toIndex: number }
  | { type: "add_logic"; rule: LogicRule }
  | { type: "delete_logic"; ruleId: string }
  | { type: "update_theme"; changes: Partial<FormTheme> };

function unknownTargetError(targetId: number, customErr?: string) {
  if (targetId === -1) {
    throw new Error(customErr ?? "Target block not found");
  }
}

export function applyOperations(
  def: FormDefinition,
  ops: FormOperation[],
): FormDefinition {
  return produce(def, (draft) => {
    ops.forEach((op) => {
      switch (op.type) {
        case "update_form": {
          if (op.changes.title !== undefined) draft.title = op.changes.title;
          if ("description" in op.changes) {
            draft.description = op.changes.description;
          }
          break;
        }

        case "add_block": {
          unknownTargetError(op.index);
          draft.blocks.splice(op.index, 0, op.block);
          break;
        }

        case "update_block": {
          const targetBlockId = draft.blocks.findIndex((b) => b.id == op.id);
          unknownTargetError(targetBlockId);
          draft.blocks[targetBlockId] = {
            ...draft.blocks[targetBlockId],
            ...op.changes,
          } as FormBlock;
          break;
        }

        case "delete_block": {
          const targetBlockId = draft.blocks.findIndex((b) => b.id == op.id);
          unknownTargetError(targetBlockId);
          draft.blocks.splice(targetBlockId, 1);
          break;
        }

        case "move_block": {
          const targetBlockId = draft.blocks.findIndex((b) => b.id == op.id);
          unknownTargetError(targetBlockId);
          const item = draft.blocks.splice(targetBlockId, 1)[0];
          draft.blocks.splice(op.toIndex, 0, item);
          break;
        }

        case "add_logic": {
          draft.logic.push(op.rule);
          break;
        }

        case "delete_logic": {
          const targetLogicId = draft.logic.findIndex((l) => l.id == op.ruleId);
          unknownTargetError(targetLogicId);
          draft.logic.splice(targetLogicId, 1);
          break;
        }

        case "update_theme": {
          draft.theme = { ...draft.theme, ...op.changes } as FormTheme;
          break;
        }
      }
    });

    return draft;
  });
}
