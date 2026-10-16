import assert from "node:assert/strict";
import test from "node:test";
import { writeBasicTap, writeTapBlock } from "@zxcode/core";

// Independent field/parity derivation: docs/design/019-tap-container.md.
const filenameBytes = Uint8Array.from([0x58, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20]);
const metadata = { filenameBytes, autostart: 0x8000, variablesOffset: 2 };
const payload = Uint8Array.of(1, 2, 3);

test("exact type-zero header, data block, lengths and independent XOR bytes", () => {
  const expected = Uint8Array.from([
    0x13, 0x00, 0x00, 0x00,
    0x58, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
    0x03, 0x00, 0x00, 0x80, 0x02, 0x00, 0xf9,
    0x05, 0x00, 0xff, 0x01, 0x02, 0x03, 0xff
  ]);
  assert.deepEqual(writeBasicTap(payload, metadata).tapBytes, expected);
  assert.deepEqual(writeBasicTap(payload, metadata).tapBytes, expected);
});

test("autostart and word fields are explicit and little-endian", () => {
  const tap = writeBasicTap(new Uint8Array(0x1234), {
    filenameBytes,
    autostart: 0x2345,
    variablesOffset: 0x1230
  }).tapBytes;
  assert.deepEqual([...tap.slice(14, 20)], [0x34, 0x12, 0x45, 0x23, 0x30, 0x12]);
  assert.deepEqual([...tap.slice(21, 24)], [0x36, 0x12, 0xff]);
});

test("empty payload and flag-inclusive parity", () => {
  assert.deepEqual([...writeTapBlock(0xff, new Uint8Array())], [2, 0, 0xff, 0xff]);
  assert.deepEqual([...writeTapBlock(0, Uint8Array.of(0x12, 0x34))], [4, 0, 0, 0x12, 0x34, 0x26]);
  const empty = writeBasicTap(new Uint8Array(), { ...metadata, variablesOffset: 0 });
  assert.equal(empty.tapBytes.length, 25);
});

test("container bounds include flag and parity and never wrap lengths", () => {
  const max = new Uint8Array(65533);
  const block = writeTapBlock(0xff, max);
  assert.deepEqual([...block.slice(0, 3)], [0xff, 0xff, 0xff]);
  assert.equal(block.length, 65537);
  assert.equal(writeBasicTap(max, { ...metadata, variablesOffset: max.length }).tapBytes.length, 65558);
  assert.throws(() => writeTapBlock(0xff, new Uint8Array(65534)), RangeError);
  assert.throws(() => writeBasicTap(new Uint8Array(65534), metadata), RangeError);
  for (const flag of [-1, 256, 0.5, NaN]) assert.throws(() => writeTapBlock(flag, payload), RangeError);
  for (const autostart of [-1, 65536, Infinity, 0.5]) {
    assert.throws(() => writeBasicTap(payload, { ...metadata, autostart }), RangeError);
  }
  for (const variablesOffset of [-1, 4, 0.5, NaN]) {
    assert.throws(() => writeBasicTap(payload, { ...metadata, variablesOffset }), RangeError);
  }
  for (const length of [0, 9, 11]) {
    assert.throws(() => writeBasicTap(payload, { ...metadata, filenameBytes: new Uint8Array(length) }), RangeError);
  }
  assert.throws(() => writeTapBlock(0, [1, 2, 3]), TypeError);
});

test("writer copies opaque bytes and retains no caller input buffers", () => {
  const data = Uint8Array.of(0xff, 0x0e, 0x00);
  const name = filenameBytes.slice();
  const result = writeBasicTap(data, { ...metadata, filenameBytes: name });
  const original = result.tapBytes.slice();
  data.fill(0);
  name.fill(0);
  assert.deepEqual(result.tapBytes, original);
  result.tapBytes.fill(0);
  assert.equal(writeBasicTap(payload, metadata).tapBytes[4], 0x58);
});
