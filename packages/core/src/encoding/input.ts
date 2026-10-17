import { unhandledEncodingNode } from "./exhaustive.js";
import { emitAssignableTarget } from "./targets.js";
import { romTokenBySpelling } from "../source/rom-tokens.js";
import type { BasicInputStatement } from "../semantic/input.js";
import { emitPrintItem } from "./print.js";

export function emitInputStatement(node: BasicInputStatement, emit: (byte: number) => void): void {
  emit(romTokenBySpelling("INPUT")!.byte);
  for (const item of node.items) {
    switch (item.kind) {
      case "input-empty": break;
      case "input-separator": emit(item.separator.charCodeAt(0)); break;
      case "input-target":
        if (item.lineMode) emit(romTokenBySpelling("LINE")!.byte);
        emitAssignableTarget(item.target, emit);
        break;
      case "input-display": emitPrintItem(item.item, emit); break;
      case "input-group":
        emit(0x28);
        for (const printed of item.items) emitPrintItem(printed, emit);
        emit(0x29);
        break;
      default: unhandledEncodingNode(item);
    }
  }
}
