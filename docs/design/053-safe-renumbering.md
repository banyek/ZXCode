# M7 safe BASIC renumber semantics

Decision: renumber is an explicit, previewed source transform over the shared
validated language model. It does not add labels, implicit line numbers or a
new BASIC dialect. Its guarantee is preservation of proven literal line
destinations and stored-program order; it does not claim full observational
identity for programs that inspect their own listing, line numbers, RAM layout
or replace/modify the program at runtime.

## Authority and destination catalogue

Original Sinclair [Appendix C](https://worldofspectrum.org/ZXBasicManual/zxmanappc.html)
defines GO TO as a lower-bound line lookup, GO SUB/RUN through that transfer,
LIST/LLIST by a lower-bound listing start, and SAVE LINE as saved autostart.
[Chapter 6](https://worldofspectrum.org/ZXBasicManual/zxmanchap6.html) defines
RESTORE by the DATA suffix at/after its bound. These facts require more than a
textual search for existing line declarations.

| Semantic field | Explicit target | Implicit form |
| --- | --- | --- |
| GO TO / GO SUB | `target` | None |
| RUN / RESTORE | First optional numeric operand | Start bound 0; no edit |
| LIST / LLIST | `startLine` | Start bound 0; stream number is never a line target |
| SAVE program LINE | `form.line` | SAVE without LINE has no target |

Recurse into IF tails, including nested IFs and colon-separated statements.
RETURN/CONTINUE/NEXT have no textual target to rewrite. FOR limits/steps, numeric
DATA/PRINT values, stream numbers, CODE addresses/lengths, strings, REM contents
and other operands are not candidates. LOAD/VERIFY/MERGE fields are not SAVE LINE.
Use typed statement fields, not token-looking text or regex substitution.

A proven target is a number/BIN literal, optionally wrapped only in transparent
parentheses, whose already converted Spectrum storage is an exact integer in
0..9999. Project its stored value through shared numeric code. Do not evaluate
arithmetic, unary operators, variables, functions, VAL or strings in the host.
Computed/unproven targets block an actual numbering change. Fractional or wider
literal targets also block instead of guessing ROM coercion/flag behavior.
An unchanged/no-op scheme needs no target rewrites and does not manufacture edits.

## Selection, numbering and order

Options use old BASIC numbers: `fromLine`..`throughLine` inclusive, default
1..9999. Assign selected declarations in ascending **stored numeric order** to
`start + index * step`, with defaults start 10, step 10. Start/step and old bounds
must be positive safe integers in 1..9999; from must not exceed through. Every
new declaration must remain 1..9999. Duplicate/invalid source declarations block
before any plan is made. An empty selection yields an unchanged preview.

Unselected declarations keep their numbers. Check all final numbers together;
collisions and crossing an unselected neighbour block the entire operation.
Strict global order preservation protects fallthrough, FOR/NEXT and DATA suffixes.
Do not reorder physical source lines, even if their input order differs from
stored order. Renumbering a valid source does not silently sort its file.

Only changed declarations get decimal replacement text. Unchanged spelling,
including leading zeros, stays intact. Likewise, only targets requiring a numeric
change are replaced; a touched pure target expression becomes canonical decimal
text, including a touched BIN or parenthesized literal. Surrounding source is
preserved exactly. This normalization is shown in the preview.

## Reference proof and gaps

For an exact original declaration target, use that declaration's mapped number.
For an unresolved in-range bound, identify the first stored line at/after it.
If the unchanged bound still resolves to the same original line after mapping,
keep its spelling. Otherwise replace it with that anchor's mapped number. This
preserves the same suffix for jumps, listings and RESTORE's later DATA search.
Do not pretend the old gap value was itself a stored declaration.

Explicit zero remains zero: declarations are positive and order is preserved, so
it still denotes the beginning. If a bound originally lies past the last line,
leave it when it remains past the new last line. If it would capture a new line,
use new maximum + 1 when that is still <=9999; otherwise block with a ranged
end-target issue. Do not invent a value in the wider ROM argument/flag domain.
Each reference audit records exact/following/start/end resolution and old/new
values, even where its text remains unchanged.

Example: old stored lines 10,20 become 100,110. `GO TO 20` becomes `GO TO 110`;
`GO TO 15` also becomes `GO TO 110` because leaving 15 would select old line 10.
A `PRINT 20`, `DATA 20`, quoted `"GO TO 20"` or REM tail is unchanged.

## Preview and atomic application

The core returns an immutable LanguageQueryResult bound to the exact queried
snapshot identity. A preview has a declaration table, explicit reference audit,
disjoint source-ranged edits, proposed complete text and guarantee notes. Edits
are ordered by source offset for review and applied from the end. A blocked
result has issues and **no partial edit plan**. Option/program/collision/order,
unproven/unsupported reference, end-target and post-validation issues are distinct
operation outcomes, not new syntax errors in an otherwise valid BASIC file.

Require the entire original document to pass shared diagnostics/build readiness.
Compile the proposed text through the same core pipeline, including byte limits;
a failed result blocks apply. Do not report new-text offsets as old-source ranges.
The checked apply helper rejects blocked or stale previews. The current snapshot
must be the same identity object, preventing edit/undo/reopen from validating an
older preview accidentally. The host then applies all text edits atomically and
rechecks its live document version before writing. Preview/diff is available
before an explicit Apply action; creating a preview never mutates source.

The transform preserves explicit structural destinations for the original single
stored program. Dynamic program replacement/self-modification, memory/source
inspection and effects of later independent edits are outside that guarantee.
It neither links other files nor guesses that arbitrary numeric DATA is a label.
