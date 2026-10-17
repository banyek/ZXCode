/** Host-side contract. BASIC core and editor protocol types never depend on it. */
export interface EmulatorArtifact {
  /** Absolute host path to an already built TAP; owned by the caller. */
  readonly path: string;
  readonly format: "tap";
  readonly target: "spectrum-48k";
  /** Opaque identity assigned by build orchestration, not the TAP filename. */
  readonly buildId: string;
}
export interface EmulatorLaunchRequest {
  readonly artifact: EmulatorArtifact;
  readonly workingDirectory?: string;
}
export type EmulatorFeature = "stop" | "pause" | "memory" | "breakpoints";
export interface EmulatorCapabilities {
  readonly transport: "external-process" | "debug-session";
  readonly formats: readonly "tap"[];
  readonly targets: readonly "spectrum-48k"[];
  readonly features: readonly EmulatorFeature[];
}
export type EmulatorFailureCode = "not-found" | "not-executable" | "unsupported-platform" | "unsupported-artifact" | "invalid-request" | "launch-failed" | "runtime-failed" | "cancelled" | "unsupported-operation";
export interface EmulatorFailure {
  readonly kind: "error";
  readonly code: EmulatorFailureCode;
  readonly message: string;
}
export type EmulatorState = "running" | "exited" | "stopped" | "failed";
export interface EmulatorExit {
  readonly state: Exclude<EmulatorState, "running">;
  readonly code: number | null;
  readonly signal: string | null;
  readonly failure?: EmulatorFailure;
}
export interface EmulatorSession {
  readonly id: string;
  readonly backendId: string;
  readonly artifact: EmulatorArtifact;
  readonly state: EmulatorState;
  /** Settles once, never rejects. The artifact must remain available until then. */
  readonly finished: Promise<EmulatorExit>;
  /** Idempotent; successful completion means the session is terminal. */
  stop(): Promise<{readonly kind: "success"} | EmulatorFailure>;
}
export type EmulatorLaunchResult = {readonly kind: "success"; readonly session: EmulatorSession} | EmulatorFailure;
export interface EmulatorLaunchOptions {
  /** Cancels startup only; delivered sessions are stopped explicitly. */
  readonly signal?: AbortSignal;
}
export interface EmulatorBackend {
  readonly id: string;
  readonly capabilities: EmulatorCapabilities;
  launch(request: EmulatorLaunchRequest, options?: EmulatorLaunchOptions): Promise<EmulatorLaunchResult>;
}
