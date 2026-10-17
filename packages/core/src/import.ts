import { decodeBasicProgram } from "./decoding/basic.js";
import type { DecodedBasicProgram } from "./decoding/basic.js";
import { decodeSpectrumText } from "./decoding/spectrum-text.js";
import { formatSpectrumTextContent } from "./encoding/source-text.js";
import { checkProgram } from "./build.js";
import { SourceDocument } from "./source/document.js";
import { readBasicTap } from "./tap/reader.js";
import type { ReadBasicTap, TapReadFailure } from "./tap/reader.js";

export interface BasicSourceExport {
  readonly kind: "exact" | "unsupported";
  readonly decoded: DecodedBasicProgram;
  readonly candidateSource: string;
  readonly reasons: readonly string[];
}
/** Experimental source export: exact means the shared compiler reproduced every byte. */
export function exportBasicSource(bytes: Uint8Array): BasicSourceExport {
  const decoded = decodeBasicProgram(bytes);
  const reasons: string[] = decoded.issues.map((issue) => `${issue.code} at byte ${issue.offset}`);
  const source: string[] = [];
  for (const line of decoded.lines) {
    let body = "";
    for (const segment of line.segments) {
      if (segment.kind === "token") body += ` ${segment.token.spelling} `;
      else if (segment.kind === "literal") body += segment.character;
      else if (segment.kind === "string" || segment.kind === "rem") {
        const text = decodeSpectrumText(segment.content);
        for (const issue of text.issues) reasons.push(`${issue.code} in ${segment.kind} at byte ${segment.offset + 1 + issue.offset}`);
        const formatted = formatSpectrumTextContent(text.atoms, segment.kind);
        if (formatted.kind === "error") reasons.push(`Unrepresentable ${segment.kind} at byte ${segment.offset}`);
        else body += segment.kind === "string" ? `"${formatted.text}"` : ` REM${formatted.text}`;
      } else if (segment.kind === "raw") reasons.push(`Raw bytes at byte ${segment.offset}`);
      // Hidden numeric bytes (including FN slots) stay in decoded, then equality checks them.
    }
    source.push(`${line.number} ${body.trimStart()}`);
  }
  const candidateSource = source.length === 0 ? "" : source.join("\n") + "\n";
  const checked = checkProgram(new SourceDocument("import.bas", candidateSource));
  if (checked.kind === "error") reasons.push("Candidate source is outside the supported source language");
  else {
    const rebuilt = checked.encodedProgram.programBytes;
    if (rebuilt.length !== decoded.bytes.length || rebuilt.some((byte, index) => byte !== decoded.bytes[index])) reasons.push("Candidate source does not reproduce the stored BASIC bytes");
  }
  return Object.freeze({ kind: reasons.length === 0 ? "exact" : "unsupported", decoded, candidateSource, reasons: Object.freeze(reasons) });
}
export type BasicTapImport = { readonly kind: "tap-error"; readonly result: TapReadFailure }
  | { readonly kind: "decoded"; readonly tap: ReadBasicTap; readonly program: BasicSourceExport; readonly variables: Uint8Array };
/** Single BASIC cassette pair only; saved variables remain opaque and separate. */
export function inspectBasicTap(bytes: Uint8Array): BasicTapImport {
  const tap = readBasicTap(bytes);
  if (tap.kind === "error") return Object.freeze({ kind: "tap-error", result: tap });
  return Object.freeze({ kind: "decoded", tap, program: exportBasicSource(tap.programData.slice(0, tap.metadata.variablesOffset)), variables: tap.programData.slice(tap.metadata.variablesOffset) });
}
