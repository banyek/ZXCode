import { romTokenBySpelling } from "./rom-tokens.js";
import type { RomToken } from "./rom-tokens.js";
import type { SourceRange } from "./document.js";

export type SimpleCommandShape = "none" | "optional-number" | "number" | "colour" | "number-pair" | "plot" | "draw" | "circle" | "string" | "string-pair" | "open";
export interface SimpleCommandDefinition {
  readonly token: RomToken;
  readonly shape: SimpleCommandShape;
}
const define = (name: string, shape: SimpleCommandShape): SimpleCommandDefinition => Object.freeze({ token: romTokenBySpelling(name)!, shape });
export const SIMPLE_COMMANDS: readonly SimpleCommandDefinition[] = Object.freeze([
  ...["STOP", "RETURN", "NEW", "CONTINUE", "CLS", "COPY", "CAT"].map((name) => define(name, "none")),
  ...["RUN", "RANDOMIZE", "CLEAR", "RESTORE"].map((name) => define(name, "optional-number")),
  ...["BORDER", "PAUSE", "CLOSE #"].map((name) => define(name, "number")),
  ...["INK", "PAPER", "FLASH", "BRIGHT", "INVERSE", "OVER"].map((name) => define(name, "colour")),
  ...["POKE", "OUT", "BEEP"].map((name) => define(name, "number-pair")),
  define("PLOT", "plot"), define("DRAW", "draw"), define("CIRCLE", "circle"),
  define("FORMAT", "string"), define("ERASE", "string"), define("MOVE", "string-pair"), define("OPEN #", "open")
]);
const byName = new Map(SIMPLE_COMMANDS.map((definition) => [definition.token.spelling, definition]));
export function simpleCommandByName(name: string): SimpleCommandDefinition | undefined { return byName.get(name); }
export interface ColourControl<TExpression> {
  readonly token: RomToken;
  readonly expression: TExpression;
  readonly separator: ";" | ",";
  readonly range: SourceRange;
}
export interface SimpleCommandStatement<TExpression> {
  readonly kind: "simple-command";
  readonly range: SourceRange;
  readonly definition: SimpleCommandDefinition;
  readonly operands: readonly TExpression[];
  readonly controls: readonly ColourControl<TExpression>[];
  readonly complete: boolean;
}
