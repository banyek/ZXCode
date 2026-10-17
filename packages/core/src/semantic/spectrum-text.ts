import { SPECTRUM_CHARACTERS, spectrumLiteralByte } from "../source/characters.js";
import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument } from "../source/document.js";
import type { SourceTextContext, SourceTextPart, SpectrumTextAtom, SpectrumTextIssue } from "../source/spectrum-text.js";

const textBrand: unique symbol = Symbol("Checked Spectrum text");
const checkedValues = new WeakSet<object>();
export interface SpectrumTextValue {
  readonly atoms: readonly SpectrumTextAtom[];
  readonly bytes: readonly number[];
  readonly [textBrand]: true;
}
export type SpectrumTextAnalysis = { readonly kind: "success"; readonly value: SpectrumTextValue }
  | { readonly kind: "error"; readonly issues: readonly SpectrumTextIssue[] };
const controls = new Map(SPECTRUM_CHARACTERS.flatMap((entry) => entry.exportIdentity.kind === "control" ? [[entry.exportIdentity.name, entry] as const] : []));
const isByte = (value: number): boolean => Number.isInteger(value) && value >= 0 && value <= 255;

/** Validate representation only; runtime rendering domains are contextual. */
export function analyzeSpectrumText(input: readonly SpectrumTextAtom[]): SpectrumTextAnalysis {
  const atoms: SpectrumTextAtom[] = [];
  const bytes: number[] = [];
  const issues: SpectrumTextIssue[] = [];
  input.forEach((atom, itemIndex) => {
    const issue = (code: SpectrumTextIssue["code"], message: string, offset = 0, length = 0, parameterIndex?: number): void => { issues.push(Object.freeze({ code, message, itemIndex, offset, length, ...(parameterIndex === undefined ? {} : { parameterIndex }) })); };
    if (atom.kind === "text") {
      let offset = 0;
      for (const character of atom.value) {
        const byte = spectrumLiteralByte(character);
        if (byte === undefined) issue("unrepresentable-character", "Character has no direct Spectrum literal mapping.", offset, character.length);
        else bytes.push(byte);
        offset += character.length;
      }
      atoms.push(Object.freeze({ kind: "text", value: atom.value }));
    } else if (atom.kind === "byte") {
      if (!isByte(atom.value)) issue("invalid-byte", "Raw text byte must be an integer from 0 to 255.");
      else bytes.push(atom.value);
      atoms.push(Object.freeze({ kind: "byte", value: atom.value }));
    } else {
      const definition = controls.get(atom.name);
      if (definition === undefined) { issue("unknown-control", "Unknown named Spectrum text control."); return; }
      const count = definition.parameterCount ?? 0;
      if (!Array.isArray(atom.parameters) || atom.parameters.length !== count) { issue("invalid-parameters", `${atom.name} requires exactly ${count} parameter byte(s).`); return; }
      bytes.push(definition.byte);
      for (let index = 0; index < atom.parameters.length; index++) {
        const value = atom.parameters[index]!;
        if (!isByte(value)) issue("invalid-byte", "Control parameter must be an integer from 0 to 255.", 0, 0, index);
        else bytes.push(value);
      }
      atoms.push(Object.freeze({ kind: "control", name: atom.name, parameters: Object.freeze([...atom.parameters]) }));
    }
  });
  if (issues.length !== 0) return Object.freeze({ kind: "error", issues: Object.freeze(issues) });
  const value: SpectrumTextValue = Object.freeze({ atoms: Object.freeze(atoms), bytes: Object.freeze(bytes), [textBrand]: true as const });
  checkedValues.add(value);
  return Object.freeze({ kind: "success", value });
}
export function checkedSpectrumTextBytes(value: SpectrumTextValue): readonly number[] {
  if (!checkedValues.has(value)) throw new TypeError("Expected checked Spectrum text.");
  return value.bytes;
}

/** Quoted ROM strings cannot contain byte 13, including control payload bytes. */
export function spectrumStringIssues(value: SpectrumTextValue): readonly SpectrumTextIssue[] {
  checkedSpectrumTextBytes(value);
  if (!value.bytes.includes(13)) return Object.freeze([]);
  const issues: SpectrumTextIssue[] = [];
  value.atoms.forEach((atom, itemIndex) => {
    const bytes = atom.kind === "byte" ? [atom.value] : atom.kind === "control" ? [controls.get(atom.name)!.byte, ...atom.parameters] : [];
    if (bytes.includes(13)) issues.push(Object.freeze({ code: "unrepresentable-string-byte", message: "Byte 13 cannot be stored inside a quoted 48K ROM string; use CHR$ 13 in an expression.", itemIndex, offset: 0, length: 0 }));
  });
  return Object.freeze(issues);
}

/** Adapt source parts to checked bytes without losing physical source ranges. */
export function analyzeSourceText(source: SourceDocument, parts: readonly SourceTextPart[], diagnostics: Diagnostic[], context: SourceTextContext = "string"): SpectrumTextValue | undefined {
  let valid = true;
  for (const part of parts) if (part.kind === "error") {
    valid = false;
    if (!diagnostics.some((item) => item.code === DiagnosticCodes.invalidEscape && item.range.sourceId === source.id && item.range.start === part.range.start && item.range.end === part.range.end)) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.invalidEscape, severity: "error", category: "syntax", message: part.message, range: part.range }));
  }
  const usable = parts.filter((part) => part.kind !== "error");
  const analyzed = analyzeSpectrumText(usable.map((part) => part.kind === "text" ? { kind: "text", value: part.value } : part.atom));
  const issues = analyzed.kind === "error" ? analyzed.issues : context === "string" ? spectrumStringIssues(analyzed.value) : [];
  for (const issue of issues) {
    valid = false;
    const part = usable[issue.itemIndex]!;
    const range = part.kind === "text" ? source.range(part.range.start + issue.offset, part.range.start + issue.offset + issue.length) : part.range;
    const compatibility = issue.code === "unrepresentable-character" || issue.code === "unrepresentable-string-byte";
    diagnostics.push(createDiagnostic({ code: issue.code === "unrepresentable-string-byte" ? DiagnosticCodes.unrepresentableStringByte : compatibility ? DiagnosticCodes.unsupportedCharacter : DiagnosticCodes.invalidEscape, severity: "error", category: compatibility ? "compatibility" : "syntax", message: issue.message, range }));
  }
  return valid && analyzed.kind === "success" ? analyzed.value : undefined;
}
