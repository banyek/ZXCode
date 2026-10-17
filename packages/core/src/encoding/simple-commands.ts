import type { SimpleCommandStatement } from "../source/simple-commands.js";
import type { TypedExpression } from "../semantic/expression.js";
import { emitExpression } from "./expression.js";

/** Internal emitter; the public program encoder still requires BuildableProgram. */
export function emitSimpleCommand(node: SimpleCommandStatement<TypedExpression>, emit: (byte: number) => void): void {
  emit(node.definition.token.byte);
  for (const control of node.controls) {
    emit(control.token.byte);
    emitExpression(control.expression, emit);
    emit(control.separator.charCodeAt(0));
  }
  for (let index = 0; index < node.operands.length; index++) {
    if (index !== 0) emit(0x2c);
    emitExpression(node.operands[index]!, emit);
  }
}
