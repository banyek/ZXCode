# M1 numeric literal conversion

Status: researched contract for M1-07. Numeric storage must reproduce the original
48K ROM's literal conversion, including its rounding behavior. An ideal decimal
conversion or an IEEE byte dump is insufficient.

## Evidence

- [Sinclair manual, chapter 24](https://worldofspectrum.org/ZXBasicManual/zxmanchap24.html):
  source constants retain their text followed by character 14 and five storage bytes.
- [S-DECIMAL, 268D](https://skoolkid.github.io/rom/asm/268D.html): syntax checking
  calls DEC-TO-FP and inserts 0Eh plus those five bytes. Execution uses that stored
  value, so replacing it with a differently rounded value changes semantics.
- [STACK-BC, 2D2B](https://skoolkid.github.io/rom/asm/2D2B.html): small integers use
  exponent zero, sign byte, low/high value bytes, and a final zero.
- [DEC-TO-FP, 2C9B](https://skoolkid.github.io/rom/asm/2C9B.html): decimal fraction
  digits are added using successive divisions by ten. E/e notation has a signed
  exponent whose magnitude must not exceed 127 before scaling.
- [INT-TO-FP, 2D3B](https://skoolkit.ca/disassemblies/rom/hex/asm/2D3B.html): integer
  digits accumulate through multiplication by ten and addition.
- [E-TO-FP, 2D4F](https://skoolkid.github.io/rom/asm/2D4F.html): scaling processes
  exponent bits from low to high, squaring the current power of ten between bits.
- [SHIFT-FP, 2FDD](https://skoolkit.ca/disassemblies/rom/hex/asm/2FDD.html): addition
  rounds the aligned smaller operand before adding; differences above 32 bits
  discard it. A carry can require another rounded shift.
- [Multiplication/normalization, 30CA](https://skoolkid.github.io/rom/asm/30CA.html)
  and [division, 31AF](https://skoolkid.github.io/rom/asm/31AF.html): four-byte
  significands, exponent normalization, rounding, overflow, and near-zero handling.
  Division loses the 34th quotient bit: when the significand ratio is below one,
  the final rounding bit is missing. Reproducing that truncation is intentional.

## Algorithm and boundary

The semantic literal converter consumes one unsigned decimal token, retaining its
lexeme and checked storage bytes. It accepts digits with an optional decimal
point, or a leading point followed by digits, and optional E/e with signed decimal
exponent digits. Unary signs are expression syntax. BIN belongs to later grammar
work. This API does not parse BASIC statements or recognize numbers inside strings.

Internally use positive 32-bit significands and integer exponents with BigInt
arithmetic. Preserve short integer form when ROM integer addition/multiplication
does; otherwise normalize and round each operation at ROM precision. Process
integer digits, fractional digits, then exponent scaling in ROM order. The
smallest positive full value is 2^-128; near underflow rounds values from 2^-129
up to that minimum, with smaller results becoming short zero. Overflow is a
recoverable conversion failure, not Infinity or a truncated byte field.

The BASIC encoder consumes the converted semantic value and appends its 0Eh
marker/storage. It must not parse the lexeme again. All filename/default/source
ordering decisions remain outside this numeric contract.

## Independent evidence and reproduction

`tests/fixtures/numeric-rom.json` records literal-to-storage/error observations
obtained by SkoolKit 10.1 executing DEC-TO-FP in its bundled, unmodified 16K 48K
ROM. The SHA-256 is pinned in the fixture and verifier. No ROM image is copied
into ZXCode. The research harness initializes CH_ADD, STKBOT/STKEND, MEM and a
sentinel return address, then checks full token consumption and stack shape.
An instruction bound prevents a failed experiment from hanging.

Representative ROM results: `0` → `00 00 00 00 00`, `65535` → `00 00 FF FF 00`,
`65536` → `91 00 00 00 00`, `.5` → `7F 7F FF FF FF`, `0.1` → `7D 4C CC CC CC`,
`1.25` → `81 20 00 00 00`, `1E2` → `00 00 64 00 00`. In particular `.5` is
slightly below exact 1/2; the encoder must preserve this ROM result.

Recheck independently, in a temporary virtual environment with `skoolkit==10.1`:

```sh
python scripts/research/verify-numeric-rom.py
```

The verifier reads expectations and never rewrites them. Normal CI uses the fixed
observations and needs neither Python, SkoolKit, nor a ROM. Future numeric/binary
mismatches require a compatibility investigation; fixtures are not regenerated to
match ZXCode. This corpus proves numeric conversion, not M1 emulator acceptance.
