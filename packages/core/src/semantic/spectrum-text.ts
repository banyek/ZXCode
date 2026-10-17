import { SPECTRUM_CHARACTERS, spectrumLiteralByte } from "../source/characters.js";
import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import type { SpectrumTextAtom, SpectrumTextIssue } from "../source/spectrum-text.js";

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

/** Adapt literal part issues to original source coordinates, including doubled quotes. */
export function analyzeSourceText(source: SourceDocument, parts: readonly { readonly value: string; readonly range: SourceRange }[], diagnostics: Diagnostic[]): SpectrumTextValue | undefined {
  const analyzed = analyzeSpectrumText(parts.map((part) => ({ kind: "text", value: part.value })));
  if (analyzed.kind === "success") return analyzed.value;
  for (const issue of analyzed.issues) {
    const part = parts[issue.itemIndex]!;
    diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unsupportedCharacter, severity: "error", category: "compatibility", message: issue.message, range: source.range(part.range.start + issue.offset, part.range.start + issue.offset + issue.length) }));
  }
  return undefined;
}
