# M3 independent compatibility corpus

The corpus consolidates independent evidence already established by M1–M3; it
does not regenerate expected bytes from ZXCode. A checked-in manifest pins each
fixture file by SHA-256, records its authority/reproduction command and assigns a
coverage family. The runner checks compiler output against fixed expected bytes,
then exercises byte-preserving decoding and the documented exact-export contract.

Families include original-ROM numeric conversion and syntax boundaries, all-byte
source transport, contextual lexical/REM cases, graphics notation, all sixteen
control identities, the full core command corpus, and independently packed TAP
metadata. Direct-ROM evidence takes precedence over the separately retained
zmakebas comparison images. No binary fixtures or old comparison outputs change.

The runner emits a deterministic JSON report: fixture digests, case counts and
hashes of expected image streams (length-prefixed to avoid concatenation
ambiguity), without paths, dates or host details. It asserts every image against
the compiler first; report hashes alone never substitute for byte comparisons.
An explicit regeneration-free research verifier rechecks external references.

Source export is required for the eight core programs and canonical numeric,
lexical and REM inputs. All-byte escape transport additionally checks raw decoded
bytes. Eight accepted quoted raw single-byte colour/position introducers are
incomplete display packets: their stored BASIC bytes are valid, but the text
packet exporter reports them as unsupported. This is an explicit M3-08 limitation,
not a parser rejection or a reason to pad payload bytes.

M3-10 owns the supported-platform matrix and the final acceptance gate. This
corpus makes its report portable without broadening source import guarantees.

## Validation and reproduction

`npm run test:compatibility` runs 448 fixed cases from nine pinned fixture sets.
There are 389 exact source exports, nine expected source rejections and eight
explicitly enumerated unsupported exports; remaining cases check text packets and
opaque TAP metadata. `npm run check` includes this corpus in normal CI.

With the separately installed pinned tools, run:

```sh
PYTHONPATH=<skoolkit-10.1> python3 scripts/research/verify-m3-corpus.py --zmakebas <zmakebas-1.3.3>
```

This verifies every manifest digest, then independently rechecks all nine reference
sets, including the ROM font/graphics generator, numeric converter, syntax probes,
control dispatch, autostart logic, zmakebas comparisons and Python-packed TAP data.
It passes without rewriting fixtures. Normal CI needs neither external tool.
