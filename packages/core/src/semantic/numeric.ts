const literalBrand: unique symbol = Symbol("Spectrum numeric literal");
const convertedLiterals = new WeakSet<object>();

export interface NumericLiteralValue {
  readonly lexeme: string;
  readonly storage: readonly number[];
  readonly [literalBrand]: true;
}

export type NumericLiteralResult =
  | { readonly kind: "success"; readonly value: NumericLiteralValue }
  | { readonly kind: "error"; readonly reason: "invalid-literal" | "overflow" };

interface CalculatorValue {
  readonly mantissa: bigint;
  readonly exponent: number;
  readonly small?: bigint;
}

class NumericOverflow extends Error {}

const TOP_BIT = 1n << 31n;
const FULL_WORD = 1n << 32n;

function smallInteger(value: bigint): CalculatorValue {
  if (value === 0n) return { mantissa: 0n, exponent: 0, small: 0n };
  const bits = value.toString(2).length;
  return { mantissa: value << BigInt(32 - bits), exponent: bits + 128, small: value };
}

/** Normalize numerator/denominator * 2^power at the ROM's 32-bit precision. */
function normalize(numerator: bigint, denominator = 1n, power = 0, round = true): CalculatorValue {
  if (numerator === 0n) return smallInteger(0n);
  let binaryPower = numerator.toString(2).length - denominator.toString(2).length;
  const below = binaryPower >= 0
    ? numerator < (denominator << BigInt(binaryPower))
    : (numerator << BigInt(-binaryPower)) < denominator;
  if (below) binaryPower--;
  const shift = 31 - binaryPower;
  const scaledNumerator = shift >= 0 ? numerator << BigInt(shift) : numerator;
  const scaledDenominator = shift >= 0 ? denominator : denominator << BigInt(-shift);
  let mantissa = scaledNumerator / scaledDenominator;
  const remainder = scaledNumerator % scaledDenominator;
  if (round && remainder * 2n >= scaledDenominator) mantissa++;
  let exponent = binaryPower + power + 129;
  if (mantissa === FULL_WORD) {
    mantissa >>= 1n;
    exponent++;
  }
  if (exponent > 255) throw new NumericOverflow();
  if (exponent <= 0) {
    return exponent === 0 ? { mantissa: TOP_BIT, exponent: 1 } : smallInteger(0n);
  }
  return { mantissa, exponent };
}

function multiply(a: CalculatorValue, b: CalculatorValue): CalculatorValue {
  if (a.small !== undefined && b.small !== undefined) {
    const product = a.small * b.small;
    if (product <= 65535n) return smallInteger(product);
  }
  return normalize(a.mantissa * b.mantissa, 1n, a.exponent + b.exponent - 320);
}

function add(a: CalculatorValue, b: CalculatorValue): CalculatorValue {
  if (a.small !== undefined && b.small !== undefined) {
    const sum = a.small + b.small;
    if (sum <= 65535n) return smallInteger(sum);
  }
  if (a.exponent < b.exponent) [a, b] = [b, a];
  const difference = a.exponent - b.exponent;
  // SHIFT-FP rounds the smaller operand before addition, not the exact sum.
  const aligned = difference > 32 ? 0n : difference === 0 ? b.mantissa
    : (b.mantissa + (1n << BigInt(difference - 1))) >> BigInt(difference);
  return normalize(a.mantissa + aligned, 1n, a.exponent - 160);
}

function divide(a: CalculatorValue, b: CalculatorValue): CalculatorValue {
  if (b.mantissa === 0n) throw new NumericOverflow();
  if (a.mantissa === 0n) return smallInteger(0n);
  // Original 31FF jumps past the dividend shift, losing the 34th quotient bit.
  return normalize(a.mantissa, b.mantissa, a.exponent - b.exponent, a.mantissa >= b.mantissa);
}

function storage(value: CalculatorValue): readonly number[] {
  if (value.small !== undefined) {
    return Object.freeze([0, 0, Number(value.small & 255n), Number(value.small >> 8n), 0]);
  }
  return Object.freeze([
    value.exponent,
    Number((value.mantissa >> 24n) & 127n),
    Number((value.mantissa >> 16n) & 255n),
    Number((value.mantissa >> 8n) & 255n),
    Number(value.mantissa & 255n)
  ]);
}

/** Convert one unsigned decimal token; signs outside E/e belong to expressions. */
export function convertNumericLiteral(lexeme: string): NumericLiteralResult {
  const match = /^(\d+(?:\.\d*)?|\.\d+)(?:[Ee]([+-]?\d+))?$/.exec(lexeme);
  if (match === null || match[0] !== lexeme) return { kind: "error", reason: "invalid-literal" };
  const [integer = "", fractional = ""] = match[1]!.split(".");
  const ten = smallInteger(10n);
  try {
    let value = smallInteger(0n);
    for (const digit of integer) value = add(smallInteger(BigInt(digit)), multiply(value, ten));
    let place = smallInteger(1n);
    for (const digit of fractional) {
      place = divide(place, ten);
      value = add(value, multiply(smallInteger(BigInt(digit)), place));
    }
    // Only an integer bounded by 127 is converted to a host number; never the value.
    const exponent = Number(match[2] ?? 0);
    if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 127) throw new NumericOverflow();
    let remaining = Math.abs(exponent);
    let factor = ten;
    while (remaining !== 0) {
      if (remaining % 2 === 1) value = exponent < 0 ? divide(value, factor) : multiply(value, factor);
      remaining = Math.floor(remaining / 2);
      if (remaining !== 0) factor = multiply(factor, factor);
    }
    const literal: NumericLiteralValue = Object.freeze({ lexeme, storage: storage(value), [literalBrand]: true as const });
    convertedLiterals.add(literal);
    return { kind: "success", value: literal };
  } catch (error) {
    if (error instanceof NumericOverflow) return { kind: "error", reason: "overflow" };
    throw error;
  }
}

/** Internal encoder boundary: fabricated/unconverted JS input cannot emit bytes. */
export function checkedNumericStorage(value: NumericLiteralValue): readonly number[] {
  if (!convertedLiterals.has(value)) throw new TypeError("Expected a converted numeric literal.");
  return value.storage;
}

/** Exact host projection of the already rounded five-byte Spectrum value. */
export function numericLiteralNumber(literal: NumericLiteralValue): number {
  const storage = checkedNumericStorage(literal);
  const exponent = storage[0]!, a = storage[1]!, b = storage[2]!, c = storage[3]!, d = storage[4]!;
  return exponent === 0 ? b + c * 256 - (a === 255 ? 65536 : 0)
    : (a & 128 ? -1 : 1) * (1 + ((a & 127) * 2 ** 24 + b * 65536 + c * 256 + d) / 2 ** 31) * 2 ** (exponent - 129);
}
