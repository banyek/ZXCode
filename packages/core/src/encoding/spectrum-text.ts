import { checkedSpectrumTextBytes } from "../semantic/spectrum-text.js";
import type { SpectrumTextValue } from "../semantic/spectrum-text.js";
/** Owned packet bytes; BASIC quote/line framing is the outer encoder's job. */
export function encodeSpectrumText(value: SpectrumTextValue): Uint8Array { return Uint8Array.from(checkedSpectrumTextBytes(value)); }
