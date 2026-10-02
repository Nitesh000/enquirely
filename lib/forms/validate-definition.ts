import type { ConditionGroup, FormDefinition } from "./schema";

export type ValidationIssue = { message: string; blockId?: string };

function collectConditionBlockIds(group: ConditionGroup): string[] {
  if ("all" in group) {
    return group.all.flatMap(collectConditionBlockIds);
  }
  if ("any" in group) {
    return group.any.flatMap(collectConditionBlockIds);
  }
  return [group.blockId];
}

export function validateDefinition(def: FormDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const blockIds = new Set(def.blocks.map((b) => b.id));

  const seenIds = new Set<string>();
  for (const block of def.blocks) {
    if (seenIds.has(block.id)) {
      issues.push({
        message: `Duplicate block id: ${block.id}`,
        blockId: block.id,
      });
    }
    seenIds.add(block.id);
  }

  const reachable = new Set<string>(def.blocks.map((b) => b.id));

  for (const rule of def.logic) {
    const conditionBlockIds = collectConditionBlockIds(rule.condition);

    for (const id of conditionBlockIds) {
      if (!blockIds.has(id)) {
        issues.push({
          message: `Logic rule "${rule.id}" condition references unknown block: ${id}`,
          blockId: id,
        });
      }
    }

    if (
      (rule.action.type === "show" ||
        rule.action.type === "hide" ||
        rule.action.type === "jump") &&
      !blockIds.has(rule.action.target)
    ) {
      issues.push({
        message: `Logic rule "${rule.id}" action targets unknown block: ${rule.action.target}`,
        blockId: rule.action.target,
      });
    }

    if (
      rule.action.type === "jump" &&
      conditionBlockIds.includes(rule.action.target)
    ) {
      issues.push({
        message: `Logic rule "${rule.id}" jumps to the block that triggered it: ${rule.action.target}`,
        blockId: rule.action.target,
      });
    }

    if (rule.action.type === "jump") {
      reachable.add(rule.action.target);
    }
  }

  for (const block of def.blocks) {
    if (!reachable.has(block.id)) {
      issues.push({
        message: `Block is unreachable: ${block.id}`,
        blockId: block.id,
      });
    }
  }

  return issues;
}
