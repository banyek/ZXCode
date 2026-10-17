import type { CassetteStatement, ListingStatement } from "../source/storage-statements.js";
import { romTokenBySpelling } from "../source/rom-tokens.js";
import type { TypedExpression } from "../semantic/expression.js";
import { emitExpression } from "./expression.js";
export function emitListing(statement: ListingStatement<TypedExpression>, emit: (byte: number) => void): void {
  emit(romTokenBySpelling(statement.kind)!.byte);
  if (statement.stream !== undefined) { emit(0x23); emitExpression(statement.stream, emit); }
  if (statement.separator !== undefined) emit(statement.separator.text.charCodeAt(0));
  if (statement.startLine !== undefined) emitExpression(statement.startLine, emit);
}
export function emitCassette(statement: CassetteStatement<TypedExpression>, emit: (byte: number) => void): void {
  emit(romTokenBySpelling(statement.command)!.byte);
  emitExpression(statement.filename, emit);
  const form = statement.form;
  if (form.kind === "program") return;
  emit(romTokenBySpelling(form.kind === "screen" ? "SCREEN$" : form.kind === "array" ? "DATA" : form.kind)!.byte);
  if (form.kind === "line") emitExpression(form.line, emit);
  else if (form.kind === "code") {
    if (form.start !== undefined) emitExpression(form.start, emit);
    if (form.length !== undefined) { emit(0x2c); emitExpression(form.length, emit); }
  } else if (form.kind === "array") {
    if (form.identity === undefined) throw new TypeError("Cassette array requires checked identity.");
    for (const character of form.identity.canonicalName) emit(character.charCodeAt(0));
    emit(0x28); emit(0x29);
  }
}
