import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { identifyVariable, parseBasic, parseExpression, SourceDocument } from "@zxcode/core";

function identity(name, category) {
  const result = identifyVariable(name, category);
  assert.equal(result.kind, "success", `${category}: ${name}`);
  return result.identity;
}
function parse(text) {
  const source = new SourceDocument("names", text);
  return parseExpression(source, source.range(0, text.length));
}

test("numeric names preserve spelling and canonicalize only ASCII letters and source spaces", () => {
  for (const [name, canonical] of [["x", "x"], ["t42", "t42"], ["now we are six", "nowwearesix"], ["nOWWeaReSiX", "nowwearesix"], ["a 1e2", "a1e2"], ["A\t12", "a12"], ["a".repeat(400), "a".repeat(400)]]) {
    const symbol = identity(name, "numeric-scalar");
    assert.equal(symbol.sourceName, name);
    assert.equal(symbol.canonicalName, canonical);
    assert.equal(symbol.key, `numeric:${canonical}`);
    assert.equal(symbol.valueType, "numeric");
    assert.ok(Object.isFrozen(symbol));
  }
  for (const name of ["", "2001", "3 bears", "a_", "M*A*S*H", "Fotherington-Thomas", "a%", "a$", "a\n b", "á", "İ", "ſ", "a\u00a0b"]) {
    assert.equal(identifyVariable(name, "numeric-scalar").kind, "error", name);
  }
});

test("symbol families reproduce scalar/array/control coexistence and local FN identities", () => {
  assert.equal(identity("A", "numeric-scalar").key, identity("a", "for-control").key);
  assert.notEqual(identity("a", "numeric-scalar").key, identity("a", "numeric-array").key);
  assert.equal(identity("A $", "string-scalar").key, identity("a$", "string-array").key);
  assert.equal(identity("a$", "string-array").key, "string:a$");
  assert.equal(identity("F $", "function").key, "function:f$");
  assert.equal(identity("A$", "formal").key, "formal:a$");
  for (const category of ["numeric-array", "for-control"]) {
    for (const name of ["ab", "a1", "a$", "1"]) assert.equal(identifyVariable(name, category).kind, "error");
  }
  for (const category of ["string-scalar", "string-array"]) {
    for (const name of ["ab$", "a1$", "a", "a$$"]) assert.equal(identifyVariable(name, category).kind, "error");
  }
  for (const category of ["function", "formal"]) {
    assert.equal(identity("f", category).valueType, "numeric");
    assert.equal(identity("f$", category).valueType, "string");
    assert.equal(identifyVariable("foo", category).kind, "error");
  }
});

test("raw name validation agrees with complete and partial original-ROM LOOK-VARS boundaries", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/variable-rom.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const category = reference.source.endsWith("$") ? "string-scalar" : "numeric-scalar";
    assert.equal(identifyVariable(reference.source, category).kind === "success", reference.consumed === reference.source.length, reference.source);
  }
});

test("expression names retain case, spaces and source ranges without blind keyword replacement", () => {
  for (const [text, canonical] of [["now we are six", "nowwearesix"], ["A $", "a$"], ["some SIN name", "somesinname"], ["print", "print"], ["aANDb", "aandb"], ["a 1e2", "a1e2"]]) {
    const parsed = parse(text);
    assert.deepEqual(parsed.diagnostics, [], text);
    assert.equal(parsed.syntax.kind, "name-expression");
    assert.equal(parsed.syntax.spelling, text);
    assert.equal(parsed.syntax.identity.canonicalName, canonical);
    assert.equal(parsed.source.textInRange(parsed.syntax.range), text);
  }
  const parsed = parse("a AND b OR c");
  assert.deepEqual(parsed.diagnostics, []);
  assert.equal(parsed.syntax.operator, "OR");
  assert.equal(parsed.syntax.left.operator, "AND");
  assert.equal(parsed.syntax.left.left.identity.canonicalName, "a");
  assert.equal(parse("SIN a").syntax.kind, "builtin-call");
  assert.equal(parse("RND").syntax.kind, "builtin-value");
});

test("name/exponent boundaries split provisional tokens and continue through PRINT items", () => {
  const parsed = parse("a 1e+2");
  assert.deepEqual(parsed.diagnostics, []);
  assert.equal(parsed.syntax.operator, "+");
  assert.equal(parsed.syntax.left.identity.canonicalName, "a1e");
  assert.equal(parsed.syntax.right.lexeme, "2");
  const source = new SourceDocument("program", '10 PRINT a 1e+2; b 3e-4, c $: STOP');
  const program = parseBasic(source);
  assert.deepEqual(program.diagnostics, []);
  const line = program.syntax.lines[0];
  assert.equal(line.tokens.map((token) => token.text).join(""), source.textInRange(line.bodyRange));
  const items = line.statements[0].items;
  assert.equal(items[2].expression.left.identity.canonicalName, "b3e");
  assert.equal(items[4].expression.identity.key, "string:c$");
  assert.equal(line.statements[1].kind, "stop");
  assert.ok(parse("1e+").diagnostics.some((diagnostic) => diagnostic.code === "ZX1104"));
  assert.ok(!parse("a 1e+").diagnostics.some((diagnostic) => diagnostic.code === "ZX1104"));
});

test("illegal string names retain recoverable error nodes and later statements", () => {
  for (const name of ["ab$", "a1$", "a b $"]) {
    const source = new SourceDocument("bad-name", `10 PRINT ${name}: STOP\n20 CLS`);
    const parsed = parseBasic(source);
    assert.ok(parsed.diagnostics.some((diagnostic) => diagnostic.code === "ZX1105"));
    assert.equal(parsed.syntax.lines[0].statements[0].items[0].expression.kind, "error-expression");
    assert.equal(parsed.syntax.lines[0].statements[1].kind, "stop");
    assert.equal(parsed.syntax.lines[1].statements[0].kind, "cls");
  }
});
