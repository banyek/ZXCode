import { romTokenBySpelling } from "./rom-tokens.js";
import type { RomToken } from "./rom-tokens.js";

export type RuntimeCapability = "interface1";
export interface TargetProfile {
  readonly id: string;
  readonly capabilities: readonly RuntimeCapability[];
}
export const SPECTRUM_48K_TARGET: TargetProfile = Object.freeze({ id: "spectrum-48k", capabilities: Object.freeze([]) });
const extensionCommands = new Set(["CAT", "FORMAT", "MOVE", "ERASE"]);
export interface CommandAvailability {
  readonly token: RomToken;
  readonly requiredCapability?: RuntimeCapability;
  readonly available: boolean;
  readonly defaultCompletion: boolean;
}
/** Vocabulary remains authentic even when the target lacks its runtime extension. */
export function commandAvailability(spelling: string, target: TargetProfile = SPECTRUM_48K_TARGET): CommandAvailability | undefined {
  const token = romTokenBySpelling(spelling);
  if (token?.category !== "statement") return undefined;
  const requiredCapability = extensionCommands.has(token.spelling) ? "interface1" : undefined;
  const available = requiredCapability === undefined || target.capabilities.includes(requiredCapability);
  return Object.freeze({ token, ...(requiredCapability === undefined ? {} : { requiredCapability }), available, defaultCompletion: available });
}
