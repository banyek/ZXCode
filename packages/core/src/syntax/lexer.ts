import { readTextEscape } from "./text-escapes.js";
import { sourceTextValue } from "../source/spectrum-text.js";
import type { SourceTextPart } from "../source/spectrum-text.js";
import { romTokenBySpelling } from "../source/rom-tokens.js";
import type { RomToken } from "../source/rom-tokens.js";
import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";

interface TokenBase {
  readonly text: string;
  readonly range: SourceRange;
}

export type StringPart = SourceTextPart;
export interface StringToken extends TokenBase {
  readonly kind: "string";
  readonly contentRange: SourceRange;
  readonly value: string | undefined;
  readonly parts: readonly StringPart[];
  readonly closed: boolean;
}

export interface PlainToken extends TokenBase {
  readonly romToken?: RomToken;
  readonly kind: "word" | "number" | "whitespace" | "colon" | "punctuation" | "raw-tail" | "eof";
}

export type BodyToken = PlainToken | StringToken;

export interface LexedBody {
  readonly tokens: readonly BodyToken[];
  readonly diagnostics: readonly Diagnostic[];
}

/** ROM integer digit runs are contiguous; fractional NEXT-CHAR steps skip trivia. */
function numericEnd(text: string, start: number): number | undefined {
  const digit = (at: number): boolean => at < text.length && text[at]! >= "0" && text[at]! <= "9";
  const trivia = (at: number): number => { while (text[at] === " " || text[at] === "\t") at++; return at; };
  let cursor = start;
  let fractional = false;
  if (text[cursor] === ".") {
    const first = trivia(cursor + 1);
    if (!digit(first)) return undefined;
    cursor++;
    fractional = true;
  } else {
    if (!digit(cursor)) return undefined;
    while (digit(cursor)) cursor++;
    if (text[cursor] === ".") { cursor++; fractional = true; }
  }
  if (fractional) {
    let next = trivia(cursor);
    while (digit(next)) { cursor = next + 1; next = trivia(cursor); }
    if (text[next] === "E" || text[next] === "e") cursor = next;
  }
  if (text[cursor] === "E" || text[cursor] === "e") {
    let end = cursor + 1;
    let next = trivia(end);
    if (text[next] === "+" || text[next] === "-") { end = next + 1; next = trivia(end); }
    if (!digit(next)) return end; // Retain a malformed exponent as one numeric token.
    cursor = next;
    while (digit(cursor)) cursor++;
  }
  return cursor;
}

/** Lex one physical body, preserving trivia and context-sensitive raw content. */
export function lexBody(source: SourceDocument, bodyRange: SourceRange): LexedBody {
  const text = source.textInRange(bodyRange);
  const tokens: BodyToken[] = [];
  const diagnostics: Diagnostic[] = [];
  const range = (start: number, end: number): SourceRange => source.range(bodyRange.start + start, bodyRange.start + end);
  const plain = (kind: PlainToken["kind"], start: number, end: number): void => {
    const spelling = text.slice(start, end);
    const romToken = kind === "word" || kind === "punctuation" ? romTokenBySpelling(spelling) : undefined;
    tokens.push(Object.freeze({ kind, text: spelling, range: range(start, end), ...(romToken === undefined ? {} : { romToken }) }));
  };
  let cursor = 0;
  let statementStart = true;
  let ifCondition = false;
  while (cursor < text.length) {
    const start = cursor;
    const char = text[cursor]!;
    if (char === " " || char === "\t") {
      while (text[cursor] === " " || text[cursor] === "\t") cursor++;
      plain("whitespace", start, cursor);
      continue;
    }
    if (char === ":") {
      plain("colon", cursor, ++cursor);
      statementStart = true;
      ifCondition = false;
      continue;
    }
    if (char === '"') {
      cursor++;
      const contentStart = cursor;
      const parts: StringPart[] = [];
      while (cursor < text.length) {
        if (text[cursor] === '"') {
          if (text[cursor + 1] !== '"') break;
          parts.push(Object.freeze({ kind: "text", value: '"', range: range(cursor, cursor + 2) }));
          cursor += 2;
        } else {
          const escaped = readTextEscape(source, bodyRange.start + cursor, bodyRange.end, "string", diagnostics);
          if (escaped !== undefined) { parts.push(escaped.part); cursor = escaped.next - bodyRange.start; continue; }
          const partStart = cursor++;
          while (cursor < text.length && text[cursor] !== '"' && text[cursor] !== "{" && text[cursor] !== "}") cursor++;
          parts.push(Object.freeze({ kind: "text", value: text.slice(partStart, cursor), range: range(partStart, cursor) }));
        }
      }
      const contentEnd = cursor;
      const closed = cursor < text.length;
      if (closed) cursor++;
      const token: StringToken = Object.freeze({ kind: "string", text: text.slice(start, cursor), range: range(start, cursor), contentRange: range(contentStart, contentEnd), closed, value: sourceTextValue(parts), parts: Object.freeze(parts) });
      tokens.push(token);
      if (!closed) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unterminatedString, severity: "error", category: "syntax", message: "Expected a closing quote before the physical line ends.", range: token.range }));
    } else {
      const word = /^[A-Za-z][A-Za-z0-9$]*/.exec(text.slice(cursor));
      const number = numericEnd(text, cursor);
      if (word !== null) {
        cursor += word[0].length;
        plain("word", start, cursor);
        const keyword = word[0].toUpperCase();
        if (statementStart && keyword === "IF") ifCondition = true;
        if (ifCondition && keyword === "THEN") {
          statementStart = true;
          ifCondition = false;
          continue;
        }
        if (statementStart && word[0].toUpperCase() === "REM") {
          if (cursor < text.length) plain("raw-tail", cursor, text.length);
          cursor = text.length;
        }
      } else if (number !== undefined) {
        cursor = number;
        plain("number", start, cursor);
      } else {
        cursor += /^(?:<=|>=|<>)/.test(text.slice(cursor)) ? 2 : 1;
        plain("punctuation", start, cursor);
      }
    }
    statementStart = false;
  }
  plain("eof", cursor, cursor);
  return Object.freeze({ tokens: Object.freeze(tokens), diagnostics: Object.freeze(diagnostics) });
}
