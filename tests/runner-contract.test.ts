import type { EmulatorArtifact, EmulatorBackend, EmulatorLaunchRequest, EmulatorLaunchResult, EmulatorSession } from "../packages/runner/src/index.js";
const artifact: EmulatorArtifact = {path:"/build/program.tap",format:"tap",target:"spectrum-48k",buildId:"build-1"};
const request: EmulatorLaunchRequest = {artifact,workingDirectory:"/build"};
declare function externalLaunch(request: EmulatorLaunchRequest, options?: {readonly signal?: AbortSignal}): Promise<EmulatorLaunchResult>;
const external: EmulatorBackend = {id:"external",capabilities:{transport:"external-process",formats:["tap"],targets:["spectrum-48k"],features:["stop"]},launch:externalLaunch};
const debug: EmulatorBackend = {id:"future-debug",capabilities:{transport:"debug-session",formats:["tap"],targets:["spectrum-48k"],features:["stop","pause","memory","breakpoints"]},launch:externalLaunch};
void external.launch(request, {signal:new AbortController().signal});
void debug.launch(request);
declare const session: EmulatorSession;
void session.artifact.buildId;
void session.finished.then((exit) => {void exit.state;void exit.code;void exit.signal;void exit.failure?.message;});
void session.stop();
// @ts-expect-error Source text cannot stand in for a built TAP artifact.
external.launch({artifact:"10 STOP"});
// @ts-expect-error A VS Code URI object is not a host artifact path.
const editorArtifact: EmulatorArtifact = {...artifact,path:{scheme:"file",path:"/build/program.tap"}};
void editorArtifact;
// @ts-expect-error The runner does not silently accept another BASIC dialect/target.
const wrongTarget: EmulatorArtifact = {...artifact,target:"spectrum-128k"};
void wrongTarget;
// @ts-expect-error Completion cannot resolve to a running state.
const premature: Awaited<EmulatorSession["finished"]> = {state:"running",code:null,signal:null};
void premature;
