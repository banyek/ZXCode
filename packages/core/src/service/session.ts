import { SourceDocument } from "../source/document.js";
import { SPECTRUM_48K_TARGET } from "../source/target-profile.js";
import type { TargetProfile } from "../source/target-profile.js";
import { parseBasic } from "../syntax/parser.js";
import { analyzeBasic } from "../semantic/program.js";
import type { DocumentAnalysisSession, DocumentAnalysisSnapshot, DocumentSessionOptions, LanguageDocumentInput } from "./contract.js";

function validateInput(input: LanguageDocumentInput): void {
  if (input === null || typeof input !== "object" || !(input.source instanceof SourceDocument)) throw new TypeError("Session input requires a SourceDocument.");
  if (!Number.isSafeInteger(input.version) || input.version < 0) throw new RangeError("Document version must be a nonnegative safe integer.");
}
function copyProfile(profile: TargetProfile): TargetProfile {
  if (profile === null || typeof profile !== "object" || typeof profile.id !== "string" || profile.id.length === 0 || !Array.isArray(profile.capabilities)) throw new TypeError("Invalid target profile.");
  const capabilities = Array.from(profile.capabilities);
  if (capabilities.some((capability) => capability !== "interface1")) throw new TypeError("Unknown target capability.");
  return Object.freeze({ id: profile.id, capabilities: Object.freeze(capabilities) });
}
function analyze(input: LanguageDocumentInput, targetProfile: TargetProfile): DocumentAnalysisSnapshot {
  const source = input.source;
  const identity = Object.freeze({ documentId: source.id, source, version: input.version });
  const parsed = parseBasic(source);
  const analysis = analyzeBasic(parsed, { targetProfile });
  return Object.freeze({ identity, source, targetProfile, parsed, analysis });
}
class Session implements DocumentAnalysisSession {
  #current: DocumentAnalysisSnapshot;
  readonly #targetProfile: TargetProfile;
  constructor(input: LanguageDocumentInput, options: DocumentSessionOptions) {
    validateInput(input);
    this.#targetProfile = copyProfile(options.targetProfile ?? SPECTRUM_48K_TARGET);
    this.#current = analyze(input, this.#targetProfile);
    Object.freeze(this);
  }
  get current(): DocumentAnalysisSnapshot { return this.#current; }
  update(input: LanguageDocumentInput): DocumentAnalysisSnapshot {
    validateInput(input);
    if (input.source.id !== this.#current.identity.documentId) throw new TypeError("A session cannot change its document id.");
    if (input.version <= this.#current.identity.version) throw new RangeError("Document updates require a strictly increasing version.");
    const next = analyze(input, this.#targetProfile);
    this.#current = next;
    return next;
  }
}
/** Full-document analysis per accepted update; queries reuse immutable snapshots. */
export function createDocumentSession(input: LanguageDocumentInput, options: DocumentSessionOptions = {}): DocumentAnalysisSession {
  return new Session(input, options);
}
