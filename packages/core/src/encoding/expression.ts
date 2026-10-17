import { unhandledEncodingNode } from "./exhaustive.js";
import type { AccessGroup } from "../source/access.js";
import { romTokenBySpelling } from "../source/rom-tokens.js";
import type { TypedExpression } from "../semantic/expression.js";
import { encodeNumericLiteral } from "./numeric.js";

/** Emit validated semantic nodes without recursion, evaluation or source reparsing. */
export function emitExpression(expression: TypedExpression, emit: (byte: number) => void): void {
  const work: (number | TypedExpression)[] = [expression];
  const text = (value: string): number[] => Array.from(value, (character) => character.charCodeAt(0));
  const operator = (value: string): number => romTokenBySpelling(value)?.byte ?? value.charCodeAt(0);
  const schedule = (parts: readonly (number | TypedExpression)[]): void => {
    for (let index = parts.length - 1; index >= 0; index--) work.push(parts[index]!);
  };
  while (work.length !== 0) {
    const next = work.pop()!;
    if (typeof next === "number") { emit(next); continue; }
    if (next.type === "error" || next.type === "unknown") throw new TypeError("Cannot encode an invalid expression.");
    switch (next.kind) {
      case "array-access": case "string-access": schedule([next.base, ...accessParts(next.group)]); break;
      case "number": schedule([...text(next.value.lexeme), ...encodeNumericLiteral(next.value)]); break;
      case "binary-literal": schedule([romTokenBySpelling("BIN")!.byte, ...text(next.digits), ...encodeNumericLiteral(next.value)]); break;
      case "string": schedule([0x22, ...next.bytes.flatMap((byte) => byte === 0x22 ? [byte, byte] : [byte]), 0x22]); break;
      case "name": schedule(text(next.identity.canonicalName)); break;
      case "builtin-value": emit(next.token.byte); break;
      case "user-function-call": {
        const parts: (number | TypedExpression)[] = [romTokenBySpelling("FN")!.byte, ...text(next.identity.canonicalName), 0x28];
        next.arguments.forEach((argument, index) => { if (index !== 0) parts.push(0x2c); parts.push(argument); });
        parts.push(0x29);
        schedule(parts);
        break;
      }
      case "builtin-call": {
        const parts: (number | TypedExpression)[] = [next.token.byte];
        if (next.arguments.length === 2) parts.push(0x28, next.arguments[0]!, 0x2c, next.arguments[1]!, 0x29);
        else parts.push(next.arguments[0]!);
        schedule(parts);
        break;
      }
      case "unary": schedule([operator(next.operator), next.operand]); break;
      case "binary": schedule([next.left, operator(next.operator), next.right]); break;
      case "parenthesized": schedule([0x28, next.expression, 0x29]); break;
      case "error": throw new TypeError("Cannot encode an error node.");
      default: unhandledEncodingNode(next);
    }
  }
}


function accessParts(group: AccessGroup<TypedExpression>): readonly (number | TypedExpression)[] {
  const parts: (number | TypedExpression)[] = [0x28];
  for (let index = 0; index < group.selectors.length; index++) {
    if (index !== 0) parts.push(0x2c);
    const selector = group.selectors[index]!;
    if (selector.kind === "index") parts.push(selector.expression);
    else {
      if (selector.from !== undefined) parts.push(selector.from);
      if (selector.hasTo) parts.push(romTokenBySpelling("TO")!.byte);
      if (selector.to !== undefined) parts.push(selector.to);
    }
  }
  parts.push(0x29);
  return parts;
}
export function emitAccessGroup(group: AccessGroup<TypedExpression>, emit: (byte: number) => void): void {
  for (const part of accessParts(group)) {
    if (typeof part === "number") emit(part);
    else emitExpression(part, emit);
  }
}
