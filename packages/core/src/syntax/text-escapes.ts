import { SPECTRUM_CHARACTERS, spectrumCharacter } from "../source/characters.js";
import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { parseSpectrumGraphicNotation } from "../source/graphics-notation.js";
import type { SourceTextContext, SourceTextPart, SpectrumTextAtom } from "../source/spectrum-text.js";
const controls = new Map(SPECTRUM_CHARACTERS.flatMap((entry) => entry.exportIdentity.kind === "control" ? [[entry.exportIdentity.name, entry] as const] : []));
const trim = (text: string): string => text.replace(/^[ \t]+|[ \t]+$/g, "");
function decimal(text: string, maximum: number): number | undefined {
  if (!/^(0|[1-9][0-9]*)$/.test(text)) return undefined;
  const value = Number(text);
  return Number.isInteger(value) && value <= maximum ? value : undefined;
}
function escapeAtom(text: string): SpectrumTextAtom | undefined {
  const graphic = parseSpectrumGraphicNotation(text);
  if (graphic !== undefined) return Object.freeze({ kind: "byte", value: graphic.byte });
  const body = trim(text.slice(1, -1)).replace(/[a-z]/g, (letter) => letter.toUpperCase());
  const raw = /^BYTE[ \t]+0X([0-9A-F]{2})$/.exec(body);
  if (raw !== null) return Object.freeze({ kind: "byte", value: Number.parseInt(raw[1]!, 16) });
  const named = /^([A-Z]+)(?:[ \t]+(.+))?$/.exec(body);
  const definition = named === null ? undefined : controls.get(named[1]!);
  if (definition === undefined || named === null) return undefined;
  const argument = named[2];
  let parameters: number[];
  if ((definition.parameterCount ?? 0) === 0) {
    if (argument !== undefined) return undefined;
    parameters = [];
  } else if (definition.byte === 23) {
    const value = argument === undefined ? undefined : decimal(argument, 65535);
    if (value === undefined) return undefined;
    parameters = [value & 255, value >>> 8];
  } else {
    if (argument === undefined) return undefined;
    const values = argument.split(",").map((item) => decimal(trim(item), 255));
    if (values.length !== definition.parameterCount || values.some((value) => value === undefined)) return undefined;
    parameters = values as number[];
  }
  return Object.freeze({ kind: "control", name: named[1]!, parameters: Object.freeze(parameters) });
}
/** One brace item; source quotation is handled by the outer string scanner. */
export function readTextEscape(source: SourceDocument, start: number, end: number, context: SourceTextContext, diagnostics: Diagnostic[]): { readonly part: SourceTextPart; readonly next: number } | undefined {
  const character = source.text[start];
  if (character !== "{" && character !== "}") return undefined;
  const textPart = (value: string, next: number): { part: SourceTextPart; next: number } => ({ part: Object.freeze({ kind: "text", value, range: source.range(start, next) }), next });
  if (source.text[start + 1] === character && start + 1 < end) return textPart(character, start + 2);
  const error = (message: string, next: number): { part: SourceTextPart; next: number } => {
    const range = source.range(start, Math.max(start + 1, next));
    diagnostics.push(createDiagnostic({ code: DiagnosticCodes.invalidEscape, severity: "error", category: "syntax", message, range }));
    return { part: Object.freeze({ kind: "error", message, range }), next: range.end };
  };
  if (character === "}") return error("Literal closing brace must be doubled as '}}'.", start + 1);
  let close = start + 1;
  while (close < end && source.text[close] !== "}" && (context !== "string" || source.text[close] !== '"')) close++;
  if (close === end || source.text[close] !== "}") return error("Expected closing brace for text escape.", close);
  const next = close + 1;
  const atom = escapeAtom(source.text.slice(start, next));
  if (atom === undefined) return error("Unknown or malformed text escape; use doubled braces for literal brace text.", next);
  if (atom.kind === "byte") {
    const literal = spectrumCharacter(atom.value)!.literalCharacter;
    if (literal !== undefined) return textPart(literal, next);
  }
  return { part: Object.freeze({ kind: "atom", atom, range: source.range(start, next) }), next };
}
export function parseRemTextParts(source: SourceDocument, range: SourceRange, diagnostics: Diagnostic[]): readonly SourceTextPart[] {
  const parts: SourceTextPart[] = [];
  let cursor = range.start;
  while (cursor < range.end) {
    const escaped = readTextEscape(source, cursor, range.end, "rem", diagnostics);
    if (escaped !== undefined) { parts.push(escaped.part); cursor = escaped.next; continue; }
    const start = cursor++;
    while (cursor < range.end && source.text[cursor] !== "{" && source.text[cursor] !== "}") cursor++;
    parts.push(Object.freeze({ kind: "text", value: source.text.slice(start, cursor), range: source.range(start, cursor) }));
  }
  return Object.freeze(parts);
}
