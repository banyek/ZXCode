import { spectrumCharacter } from "../source/characters.js";
import type { SpectrumTextAtom, SpectrumTextDecodeIssue } from "../source/spectrum-text.js";
export interface DecodedSpectrumText {
  readonly atoms: readonly SpectrumTextAtom[];
  readonly issues: readonly SpectrumTextDecodeIssue[];
}
/** Decode packet boundaries without interpreting control payload as text/tokens. */
export function decodeSpectrumText(bytes: Uint8Array): DecodedSpectrumText {
  const atoms: SpectrumTextAtom[] = [];
  const issues: SpectrumTextDecodeIssue[] = [];
  const raw = (value: number): void => { atoms.push(Object.freeze({ kind: "byte", value })); };
  let cursor = 0;
  while (cursor < bytes.length) {
    const start = cursor;
    const byte = bytes[cursor++]!;
    const entry = spectrumCharacter(byte)!;
    if (entry.exportIdentity.kind === "control") {
      const count = entry.parameterCount ?? 0;
      if (cursor + count > bytes.length) {
        issues.push(Object.freeze({ code: "truncated-control", offset: start, length: bytes.length - start, name: entry.exportIdentity.name, requiredParameters: count, availableParameters: bytes.length - cursor }));
        raw(byte);
        while (cursor < bytes.length) raw(bytes[cursor++]!);
      } else {
        const parameters = Object.freeze(Array.from(bytes.slice(cursor, cursor + count)));
        atoms.push(Object.freeze({ kind: "control", name: entry.exportIdentity.name, parameters }));
        cursor += count;
      }
    } else if (entry.literalCharacter !== undefined) {
      const previous = atoms[atoms.length - 1];
      const value = (previous?.kind === "text" ? previous.value : "") + entry.literalCharacter;
      if (previous?.kind === "text") atoms.pop();
      atoms.push(Object.freeze({ kind: "text", value }));
    } else raw(byte);
  }
  return Object.freeze({ atoms: Object.freeze(atoms), issues: Object.freeze(issues) });
}
