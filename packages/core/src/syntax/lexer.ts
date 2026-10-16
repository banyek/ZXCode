import { romTokenBySpelling } from "../source/rom-tokens.js";
import type { RomToken } from "../source/rom-tokens.js";
import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";

interface TokenBase {
  readonly text: string;
  readonly range: SourceRange;
}

export interface StringToken extends TokenBase {
  readonly kind: "string";
  readonly contentRange: SourceRange;
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

/** Lex one physical body, preserving trivia and context-sensitive raw content. */
export function lexBody(source: SourceDocument, bodyRange: SourceRange): LexedBody {
  const text = source.textInRange(bodyRange);
  const tokens: BodyToken[] = [];
  const diagnostics: Diagnostic[] = [];
  const range = (start: number, end: number): SourceRange => source.range(bodyRange.start + start, bodyRange.start + end);
  const plain = (kind: PlainToken["kind"], start: number, end: number): void => {
    const spelling = text.slice(start, end);
    const romToken = kind === "word" ? romTokenBySpelling(spelling) : undefined;
    tokens.push(Object.freeze({ kind, text: spelling, range: range(start, end), ...(romToken === undefined ? {} : { romToken }) }));
  };
  let cursor = 0;
  let statementStart = true;
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
      continue;
    }
    if (char === '"') {
      cursor++;
      const contentStart = cursor;
      while (cursor < text.length && text[cursor] !== '"') cursor++;
      const contentEnd = cursor;
      const closed = cursor < text.length;
      if (closed) cursor++;
      const token: StringToken = Object.freeze({ kind: "string", text: text.slice(start, cursor), range: range(start, cursor), contentRange: range(contentStart, contentEnd), closed });
      tokens.push(token);
      if (!closed) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unterminatedString, severity: "error", category: "syntax", message: "Expected a closing quote before the physical line ends.", range: token.range }));
    } else {
      const word = /^[A-Za-z][A-Za-z0-9$]*/.exec(text.slice(cursor));
      const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d*)?/.exec(text.slice(cursor));
      if (word !== null) {
        cursor += word[0].length;
        plain("word", start, cursor);
        if (statementStart && word[0].toUpperCase() === "REM") {
          if (cursor < text.length) plain("raw-tail", cursor, text.length);
          cursor = text.length;
        }
      } else if (number !== null) {
        cursor += number[0].length;
        plain("number", start, cursor);
        if (/[Ee][+-]?$/.test(number[0])) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.invalidNumericLiteral, severity: "error", category: "syntax", message: "Expected decimal exponent digits.", range: range(start, cursor) }));
      } else plain("punctuation", cursor, ++cursor);
    }
    statementStart = false;
  }
  plain("eof", cursor, cursor);
  return Object.freeze({ tokens: Object.freeze(tokens), diagnostics: Object.freeze(diagnostics) });
}
