export interface SourcePosition {
  readonly line: number;
  readonly column: number;
}

function checkOffset(offset: number, length: number): void {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > length) {
    throw new RangeError(`Source offset must be an integer between 0 and ${length}.`);
  }
}

/** An immutable decoded UTF-8 source snapshot, identified by its caller. */
export class SourceDocument {
  readonly id: string;
  readonly text: string;
  readonly #lineStarts: readonly number[];

  constructor(id: string, text: string) {
    if (id.length === 0) throw new TypeError("Source identity must not be empty.");
    this.id = id;
    this.text = text;
    const starts = [0];
    for (let offset = 0; offset < text.length; offset++) {
      if (text[offset] === "\r") {
        if (text[offset + 1] === "\n") offset++;
        starts.push(offset + 1);
      } else if (text[offset] === "\n") {
        starts.push(offset + 1);
      }
    }
    this.#lineStarts = Object.freeze(starts);
    Object.freeze(this);
  }

  get lineCount(): number {
    return this.#lineStarts.length;
  }

  /** Zero-based line and UTF-16 column; offsets are UTF-16 code units. */
  positionAt(offset: number): SourcePosition {
    checkOffset(offset, this.text.length);
    let low = 0;
    let high = this.#lineStarts.length;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (this.#lineStarts[middle]! <= offset) low = middle;
      else high = middle;
    }
    return Object.freeze({ line: low, column: offset - this.#lineStarts[low]! });
  }

  offsetAt(position: SourcePosition): number {
    const { line, column } = position;
    if (!Number.isSafeInteger(line) || line < 0 || line >= this.lineCount) {
      throw new RangeError("Source line is out of bounds.");
    }
    const start = this.#lineStarts[line]!;
    // Every offset belongs to exactly one line, including offsets within CRLF.
    const end = line + 1 < this.lineCount ? this.#lineStarts[line + 1]! - 1 : this.text.length;
    if (!Number.isSafeInteger(column) || column < 0 || column > end - start) {
      throw new RangeError("Source column is out of bounds.");
    }
    return start + column;
  }

  range(start: number, end = start): SourceRange {
    return new SourceRange(this, start, end);
  }

  textInRange(range: SourceRange): string {
    if (!(range instanceof SourceRange) || range.sourceId !== this.id) {
      throw new TypeError("Range belongs to a different source snapshot.");
    }
    checkOffset(range.start, this.text.length);
    checkOffset(range.end, this.text.length);
    return this.text.slice(range.start, range.end);
  }
}

/** Checked half-open [start, end) source range; empty insertion ranges are valid. */
export class SourceRange {
  readonly sourceId: string;
  readonly start: number;
  readonly end: number;

  constructor(source: SourceDocument, start: number, end: number) {
    checkOffset(start, source.text.length);
    checkOffset(end, source.text.length);
    if (end < start) throw new RangeError("Source range end precedes its start.");
    this.sourceId = source.id;
    this.start = start;
    this.end = end;
    Object.freeze(this);
  }
}
