import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import type { CassetteForm, CassetteStatement, ListingStatement } from "../source/storage-statements.js";
import { identifyVariable } from "../source/variable-identity.js";
import { readExpression } from "./expression.js";
import type { Expression } from "./expression.js";
import type { BodyToken } from "./lexer.js";

export function parseListingStatement(source: SourceDocument, input: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[], kind: "list" | "llist"): ListingStatement<Expression> {
  let tokens = input;
  let cursor = 1;
  let stream: Expression | undefined;
  let startLine: Expression | undefined;
  let separator: ListingStatement<Expression>["separator"];
  const read = (): Expression => { const parsed = readExpression(source, tokens, cursor, range.end, diagnostics); tokens = parsed.tokens; cursor = parsed.next; return parsed.expression; };
  if (tokens[cursor]?.text === "#") {
    cursor++;
    stream = read();
    const next = tokens[cursor];
    if (next?.text === "," || next?.text === ";") {
      separator = Object.freeze({ text: next.text, range: next.range });
      cursor++;
      startLine = read();
    }
  } else if (cursor < tokens.length) startLine = read();
  const complete = cursor === tokens.length;
  if (!complete) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message: "Unexpected token after listing stream/start line.", range: tokens[cursor]!.range }));
  return Object.freeze({ kind, range, ...(stream === undefined ? {} : { stream }), ...(separator === undefined ? {} : { separator }), ...(startLine === undefined ? {} : { startLine }), complete });
}

const cassetteBoundaries = new Set(["LINE", "DATA", "SCREEN$", "CODE"]);
export function parseCassetteStatement(source: SourceDocument, input: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[], command: CassetteStatement<Expression>["command"]): CassetteStatement<Expression> {
  let tokens = input;
  let cursor = 1;
  let complete = true;
  const report = (message: string, location = source.range(tokens[cursor]?.range.start ?? range.end)): void => { complete = false; diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message, range: location })); };
  const read = (filename = false): Expression => { const parsed = readExpression(source, tokens, cursor, range.end, diagnostics, 0, filename ? cassetteBoundaries : undefined); tokens = parsed.tokens; cursor = parsed.next; return parsed.expression; };
  const filename = read(true);
  const suffix = tokens[cursor];
  let form: CassetteForm<Expression> = Object.freeze({ kind: "program" });
  if (suffix !== undefined) {
    const text = suffix.text.toUpperCase();
    cursor++;
    if (text === "LINE") {
      if (command !== "SAVE") report("Only SAVE accepts the LINE suffix.", suffix.range);
      form = Object.freeze({ kind: "line", range: source.range(suffix.range.start, range.end), line: read() });
    } else if (text === "SCREEN$") form = Object.freeze({ kind: "screen", range: source.range(suffix.range.start, range.end) });
    else if (text === "CODE") {
      const start = cursor < tokens.length ? read() : undefined;
      const comma = tokens[cursor]?.text === "," ? tokens[cursor++] : undefined;
      const length = comma === undefined ? undefined : read();
      if (command === "SAVE" && (start === undefined || length === undefined)) report("SAVE CODE requires both start and length.", suffix.range);
      form = Object.freeze({ kind: "code", range: source.range(suffix.range.start, range.end), ...(start === undefined ? {} : { start }), ...(length === undefined ? {} : { length }), ...(comma === undefined ? {} : { commaRange: comma.range }) });
    } else if (text === "DATA") {
      const from = cursor;
      while (cursor < tokens.length && tokens[cursor]!.text !== "(") cursor++;
      const nameRange = source.range(tokens[from]?.range.start ?? range.end, cursor > from ? tokens[cursor - 1]!.range.end : tokens[from]?.range.start ?? range.end);
      const name = source.textInRange(nameRange);
      const identified = identifyVariable(name, name.trimEnd().endsWith("$") ? "string-array" : "numeric-array");
      if (identified.kind === "error") report("Cassette DATA requires a single-letter array name, optionally followed by '$'.", nameRange);
      const closed = tokens[cursor]?.text === "(" && tokens[cursor + 1]?.text === ")";
      if (closed) cursor += 2;
      else report("Cassette DATA requires empty parentheses after the array name.");
      form = Object.freeze({ kind: "array", range: source.range(suffix.range.start, range.end), nameRange, ...(identified.kind === "success" ? { identity: identified.identity } : {}), closed });
    } else report("Expected LINE, DATA, SCREEN$ or CODE cassette suffix.", suffix.range);
    if (command === "MERGE" && form.kind !== "program") report("MERGE accepts only the program cassette form.", suffix.range);
  }
  if (cursor !== tokens.length) report("Unexpected token after cassette suffix.", tokens[cursor]!.range);
  return Object.freeze({ kind: "cassette", command, range, filename, form, complete });
}
