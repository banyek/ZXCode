import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ROM_TOKENS, romTokenByByte, romTokenBySpelling, parseBasic, SourceDocument } from "@zxcode/core";

const reference = JSON.parse(readFileSync(new URL("./fixtures/rom-tokens.json", import.meta.url), "utf8"));

test("catalogue matches all 91 independently decoded original ROM spellings and bytes", () => {
  assert.equal(ROM_TOKENS.length, 91);
  assert.deepEqual(ROM_TOKENS.map(({ byte, spelling }) => ({ byte, spelling })), reference);
  assert.equal(new Set(ROM_TOKENS.map((token) => token.spelling)).size, 91);
  assert.ok(Object.isFrozen(ROM_TOKENS));
  for (const [index, token] of ROM_TOKENS.entries()) {
    assert.equal(token.byte, 0xa5 + index);
    assert.equal(romTokenByByte(token.byte), token);
    assert.equal(romTokenBySpelling(token.spelling), token);
    assert.equal(romTokenBySpelling(token.spelling.toLowerCase()), token);
    assert.ok(Object.isFrozen(token));
  }
});

test("lookup does not invent aliases, normalize whitespace, or accept non-token bytes", () => {
  for (const byte of [-1, 0, 0xa4, 0x100, 0xa5 + 0.5, NaN]) assert.equal(romTokenByByte(byte), undefined);
  for (const text of ["GOTO", "GO  TO", "PRINT ", "WHILE", "", "ſin"]) assert.equal(romTokenBySpelling(text), undefined);
  assert.equal(romTokenBySpelling("DEF FN").category, "statement");
  assert.equal(romTokenBySpelling("AT").category, "print-control");
  assert.equal(romTokenBySpelling("BIN").category, "literal-prefix");
});

test("lexer shares catalogue identity while preserving identifiers, strings and REM tails", () => {
  const parsed = parseBasic(new SourceDocument("tokens.bas", '10 pRiNt "CLS GO TO": REM PRINT : "\n20 PRINT printer\n30 DEF FN'));
  const first = parsed.syntax.lines[0];
  assert.equal(first.tokens[0].romToken, romTokenByByte(0xf5));
  assert.equal(first.tokens.find((token) => token.kind === "string").romToken, undefined);
  assert.equal(first.tokens.find((token) => token.kind === "raw-tail").romToken, undefined);
  assert.equal(parsed.syntax.lines[1].tokens.find((token) => token.text === "printer").romToken, undefined);
  assert.ok(parsed.diagnostics.length > 0); // Recognition does not enable unsupported grammar.
});
