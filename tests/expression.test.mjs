import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeBasic, checkProgram, parseBasic, parseExpression, romTokenBySpelling, SourceDocument } from "@zxcode/core";

function parse(text) {
  const source = new SourceDocument("expression@1", text);
  return parseExpression(source, source.range(0, text.length));
}
const binaryCodes = { "-": 3, "*": 4, "/": 5, "^": 6, OR: 7, AND: 8, "<=": 9, ">=": 10, "<>": 11, ">": 12, "<": 13, "=": 14, "+": 15 };
const functionCodes = { SIN: 31, INT: 39, ABS: 42 };
function evaluate(node, operations) {
  if (node.kind === "numeric-literal") return Number(node.lexeme);
  if (node.kind === "parenthesized-expression") return evaluate(node.expression, operations);
  if (node.kind === "unary-expression") {
    const value = evaluate(node.operand, operations);
    if (node.operator === "+") return value;
    operations.push(node.operator === "-" ? 27 : 48);
    return node.operator === "-" ? -value : Number(value === 0);
  }
  if (node.kind === "builtin-call") {
    const value = evaluate(node.arguments[0], operations);
    operations.push(functionCodes[node.token.spelling]);
    return { SIN: Math.sin, INT: Math.floor, ABS: Math.abs }[node.token.spelling](value);
  }
  assert.equal(node.kind, "binary-expression");
  const left = evaluate(node.left, operations);
  const right = evaluate(node.right, operations);
  operations.push(binaryCodes[node.operator]);
  switch (node.operator) {
    case "+": return left + right;
    case "-": return left - right;
    case "*": return left * right;
    case "/": return left / right;
    case "^": return left ** right;
    case "OR": return Number(left !== 0 || right !== 0);
    case "AND": return right === 0 ? 0 : left;
    case "<=": return Number(left <= right);
    case ">=": return Number(left >= right);
    case "<>": return Number(left !== right);
    case ">": return Number(left > right);
    case "<": return Number(left < right);
    case "=": return Number(left === right);
    default: assert.fail(node.operator);
  }
}
function romNumber(hex) {
  const [exponent, a, b, c, d] = Buffer.from(hex, "hex");
  if (exponent === 0) return b + c * 256 - (a === 255 ? 65536 : 0);
  return (a & 128 ? -1 : 1) * (1 + ((a & 127) * 2 ** 24 + b * 65536 + c * 256 + d) / 2 ** 31) * 2 ** (exponent - 129);
}

test("expression reduction order and meaning match 38 independent original-ROM traces", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/expression-rom.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const parsed = parse(reference.source);
    assert.deepEqual(parsed.diagnostics, [], reference.source);
    const operations = [];
    const value = evaluate(parsed.syntax, operations);
    assert.deepEqual(operations, reference.operations, reference.source);
    const expected = romNumber(reference.storage);
    assert.ok(Math.abs(value - expected) <= Math.max(1, Math.abs(expected)) * 1e-8, `${reference.source}: ${value} != ${expected}`);
  }
});

test("all ordinary prefix functions use shared tokens and bind tighter than exponentiation", () => {
  const functions = ["VAL$", "CODE", "VAL", "LEN", "SIN", "COS", "TAN", "ASN", "ACS", "ATN", "LN", "EXP", "INT", "SQR", "SGN", "ABS", "PEEK", "IN", "USR", "STR$", "CHR$"];
  for (const name of functions) {
    const { syntax, diagnostics } = parse(`${name} 1^2`);
    assert.deepEqual(diagnostics, [], name);
    assert.equal(syntax.kind, "binary-expression");
    assert.equal(syntax.left.kind, "builtin-call");
    assert.equal(syntax.left.token, romTokenBySpelling(name));
    assert.equal(syntax.left.arguments[0].kind, "numeric-literal");
  }
  for (const name of ["POINT", "ATTR", "SCREEN$"]) {
    const { syntax, diagnostics } = parse(`${name}(1+2,3*4)`);
    assert.deepEqual(diagnostics, []);
    assert.equal(syntax.arguments.length, 2);
    assert.equal(syntax.closed, true);
    assert.equal(syntax.arguments[0].operator, "+");
    assert.equal(syntax.arguments[1].operator, "*");
  }
});

test("primaries retain original spelling, quoted values and exact UTF-16 ranges", () => {
  for (const [text, kind] of [['"SIN : <= 😀"', "string-literal"], [".5e+2", "numeric-literal"], ["BIN 00101", "binary-literal"], ["score2", "name-expression"], ["a$", "name-expression"], ["rNd", "builtin-value"], ["PI", "builtin-value"], ["INKEY$", "builtin-value"]]) {
    const parsed = parse(text);
    assert.deepEqual(parsed.diagnostics, []);
    assert.equal(parsed.syntax.kind, kind);
    assert.equal(parsed.source.textInRange(parsed.syntax.range), text);
    assert.ok(Object.isFrozen(parsed.syntax));
  }
  const parsed = parse("  - ( 1 + 2 ) ^ 3");
  const unary = parsed.syntax;
  assert.equal(parsed.source.textInRange(unary.operatorRange), "-");
  assert.equal(parsed.source.textInRange(unary.operand.operatorRange), "^");
  assert.equal(parsed.source.textInRange(unary.operand.left.range), "( 1 + 2 )");
});

test("incomplete expressions retain useful error nodes and item/statement recovery", () => {
  for (const text of ["", "1+", "NOT", "SIN", "(", "(1+2", "POINT(1,)", "ATTR(1 2)", "SCREEN$(,2)", "BIN 102", "1< =2", "FN f(1)", "2↑3"]) {
    const parsed = parse(text);
    assert.ok(parsed.diagnostics.length > 0, text);
    for (const diagnostic of parsed.diagnostics) {
      assert.equal(diagnostic.range.sourceId, parsed.source.id);
      assert.ok(diagnostic.range.start >= 0 && diagnostic.range.end <= text.length);
    }
  }
  const source = new SourceDocument("recovery", '10 PRINT 1+;2: STOP\n20 PRINT (3;4\n30 CLS');
  const parsed = parseBasic(source);
  const items = parsed.syntax.lines[0].statements[0].items;
  assert.equal(items[0].expression.right.kind, "error-expression");
  assert.equal(items[0].expression.right.range.start, source.text.indexOf(";"));
  assert.equal(items[2].expression.lexeme, "2");
  assert.equal(parsed.syntax.lines[0].statements[1].kind, "stop");
  assert.equal(parsed.syntax.lines[1].statements[0].items[0].expression.closed, false);
  assert.equal(parsed.syntax.lines[2].statements[0].kind, "cls");
});

test("malformed expression structure cannot bypass semantic validation, even without parser diagnostics", () => {
  for (const text of ["1+", "(1", "SIN", "POINT(1,)", "POINT 1,2)", "POINT(1 2)"]) {
    const source = new SourceDocument("pending", `10 PRINT ${text}`);
    const parsed = parseBasic(source);
    assert.equal(analyzeBasic({ ...parsed, diagnostics: [] }).kind, "invalid", text);
    assert.equal(checkProgram(source).kind, "error", text);
  }
  assert.deepEqual(parseBasic(new SourceDocument("valid-cst", "10 PRINT -2^2; SIN 1+2")).diagnostics, []);
});

test("deep editor input reports its nesting limit without throwing or losing later lines", () => {
  for (const text of ["(".repeat(300) + "1" + ")".repeat(300), "-".repeat(300) + "1"]) {
    const parsed = parseBasic(new SourceDocument("deep", `10 PRINT ${text}\n20 STOP`));
    assert.ok(parsed.diagnostics.some((diagnostic) => diagnostic.category === "tooling"));
    assert.equal(parsed.syntax.lines[1].statements[0].kind, "stop");
  }
});


test("nested incomplete nodes contain every child range, including EOF insertion points", () => {
  function visit(node, source) {
    const children = node.kind === "binary-expression" ? [node.left, node.right]
      : node.kind === "unary-expression" ? [node.operand]
      : node.kind === "parenthesized-expression" ? [node.expression]
      : node.kind === "builtin-call" ? node.arguments : [];
    for (const child of children) {
      assert.ok(child.range.start >= node.range.start && child.range.end <= node.range.end, source.text);
      visit(child, source);
    }
  }
  for (const text of ["SIN   ", "(   ", "POINT(1,   ", "NOT ( 1+", "((SIN", "1+2*", "(1+2)*3"]) {
    const parsed = parse(text);
    visit(parsed.syntax, parsed.source);
  }
});


test("BIN follows independently observed ROM empty/spaced/leading-zero digit rules", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/expression-rom.json", import.meta.url), "utf8"));
  for (const reference of fixture.binaryCases) {
    const parsed = parse(reference.source);
    assert.deepEqual(parsed.diagnostics, [], reference.source);
    assert.equal(parsed.syntax.kind, "binary-literal");
    const digits = parsed.syntax.lexeme;
    assert.equal(digits === "" ? 0 : Number(BigInt(`0b${digits}`)), romNumber(reference.storage));
    assert.equal(parsed.source.textInRange(parsed.syntax.digitsRange).replace(/ /g, ""), digits);
  }
});
