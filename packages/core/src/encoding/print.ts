import { romTokenBySpelling } from "../source/rom-tokens.js";
import type { PrintItem, PrintStatement } from "../source/print-items.js";
import type { TypedExpression } from "../semantic/expression.js";
import { emitExpression } from "./expression.js";

export function emitPrintStatement(node: PrintStatement<TypedExpression>, emit: (byte: number) => void): void {
  emit(romTokenBySpelling(node.kind === "print" ? "PRINT" : "LPRINT")!.byte);
  for (const item of node.items) emitPrintItem(item, emit);
}

export function emitPrintItem(item: PrintItem<TypedExpression>, emit: (byte: number) => void): void {
  switch (item.kind) {
    case "print-empty": break;
    case "print-separator": emit(item.separator.charCodeAt(0)); break;
    case "print-expression": emitExpression(item.expression, emit); break;
    case "print-at": emit(romTokenBySpelling("AT")!.byte); emitExpression(item.row, emit); emit(0x2c); emitExpression(item.column, emit); break;
    case "print-tab": emit(romTokenBySpelling("TAB")!.byte); emitExpression(item.column, emit); break;
    case "print-control": emit(item.token.byte); emitExpression(item.expression, emit); break;
    case "print-channel": emit(0x23); emitExpression(item.stream, emit); break;
  }
}
