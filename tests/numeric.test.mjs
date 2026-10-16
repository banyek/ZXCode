import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { convertNumericLiteral, encodeNumericLiteral } from "@zxcode/core";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/numeric-rom.json", import.meta.url), "utf8"));

test("numeric conversion matches 176 observations from the original 48K ROM", () => {
  assert.equal(fixture.cases.length, 176);
  for (const observation of fixture.cases) {
    const converted = convertNumericLiteral(observation.literal);
    if (observation.romError !== undefined) {
      assert.equal(observation.romError, 5); // Report 6: Arithmetic overflow.
      assert.deepEqual(converted, { kind: "error", reason: "overflow" }, observation.literal);
    } else {
      assert.equal(converted.kind, "success", observation.literal);
      assert.equal(converted.value.lexeme, observation.literal);
      assert.equal(Buffer.from(converted.value.storage).toString("hex"), observation.storage, observation.literal);
      assert.equal(Buffer.from(encodeNumericLiteral(converted.value)).toString("hex"), "0e" + observation.storage, observation.literal);
    }
  }
});

test("ROM decimal rounding is preserved rather than replaced with exact host arithmetic", () => {
  const value = convertNumericLiteral(".5").value;
  assert.deepEqual([...encodeNumericLiteral(value)], [0x0e, 0x7f, 0x7f, 0xff, 0xff, 0xff]);
  assert.notDeepEqual(value.storage, [0x80, 0, 0, 0, 0]); // Exact binary 1/2.
});

test("malformed tokens and expression signs fail recoverably without encoding source", () => {
  for (const lexeme of ["", ".", "+1", "-1", "1+2", "0x10", "1e", "1e+", "1e1.5", "1.2.3", "1_000", "١", " 1", "1 ", "1\n", "BIN 10", "10 PRINT 1"]) {
    assert.deepEqual(convertNumericLiteral(lexeme), { kind: "error", reason: "invalid-literal" }, lexeme);
  }
  assert.throws(() => encodeNumericLiteral("1"), TypeError);
  assert.throws(() => encodeNumericLiteral({ lexeme: "1", storage: [0, 0, 1, 0, 0] }), TypeError);
});

test("numeric conversion is immutable and encoding returns independent buffers", () => {
  const { value } = convertNumericLiteral("0001.25e+0");
  assert.equal(value.lexeme, "0001.25e+0");
  assert.throws(() => { value.storage[0] = 0; }, TypeError);
  assert.throws(() => { value.lexeme = "2"; }, TypeError);
  assert.throws(() => encodeNumericLiteral({ ...value, storage: [0, 0, 2, 0, 0] }), TypeError);
  const first = encodeNumericLiteral(value);
  first.fill(0);
  assert.deepEqual([...encodeNumericLiteral(value)], [0x0e, 0x81, 0x20, 0, 0, 0]);
});
