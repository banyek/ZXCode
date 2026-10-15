# Reference sources

These references guide compatibility research. Primary Sinclair/ROM behaviour wins over convenience behaviour in third-party tools.

## Primary and implementation-level references

- **ZX Spectrum BASIC Programming manual** — original Sinclair BASIC documentation. Useful for statement/function syntax, expressions, variables, graphics, I/O and programming model.
  - https://worldofspectrum.org/ZXBasicManual/
- **The Complete Spectrum ROM Disassembly** — implementation-level reference for the original ROM interpreter, syntax tables, token handling and numeric routines.
  - https://skoolkid.github.io/rom/

## Independent tooling references

- **zmakebas** — established text BASIC to tokenized/TAP tooling; useful as an independent encoder comparison and for studying textual conventions.
  - https://github.com/z00m128/zmakebas
- **zmakebas+** — modernized/browser-capable descendant with syntax checking/import-export behaviour useful for comparison.
  - https://github.com/maziac/zmakebas
- **BAS2TAP** — Spectrum BASIC syntax checking and TAP generation; useful as an independent behavioural reference.
  - Research exact canonical upstream/source location before relying on implementation details.

## Additional reference

- **z88dk Spectrum BASIC/token documentation** — useful machine-readable-ish cross-check for token names/values, but exact values must still be reconciled with ROM/primary references.
  - https://github.com/z88dk/z88dk

## Research rule

Do not copy a third-party tool's extensions into ZXCode merely because the tool accepts them. In particular, labels, line-numberless source and other authoring conveniences may be useful in those tools but conflict with ZXCode's initial compatibility philosophy.

Where references disagree, record the disagreement and resolve it explicitly against the target ROM.
