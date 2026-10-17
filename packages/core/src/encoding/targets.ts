import type { BasicAssignableTarget } from "../semantic/targets.js";
import { emitAccessGroup } from "./expression.js";

export function emitAssignableTarget(target: BasicAssignableTarget, emit: (byte: number) => void): void {
  for (const character of target.identity.canonicalName) emit(character.charCodeAt(0));
  if (target.kind === "indexed-target") for (const group of target.groups) emitAccessGroup(group, emit);
}
