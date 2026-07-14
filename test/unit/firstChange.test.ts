import * as assert from 'assert';
import { primaryChangedLine } from '../../src/firstChange';

describe('primaryChangedLine', () => {
  it('returns 0 for untracked files (no baseline) — everything is new', () => {
    assert.strictEqual(primaryChangedLine(undefined, 'a\nb\n'), 0);
  });

  it('finds a simple in-place edit', () => {
    assert.strictEqual(primaryChangedLine('a\nb\nc\n', 'a\nX\nc\n'), 1);
  });

  it('finds a pure append (first new line just past the baseline)', () => {
    assert.strictEqual(primaryChangedLine('line1\n', 'line1\nline2\n'), 1);
  });

  it('finds a change on the first line', () => {
    assert.strictEqual(primaryChangedLine('a\nb\n', 'X\nb\n'), 0);
  });

  it('handles truncation (lines deleted from the end)', () => {
    assert.strictEqual(primaryChangedLine('a\nb\nc\n', 'a\n'), 1);
  });

  it('returns 0 for identical content instead of a bogus position', () => {
    assert.strictEqual(primaryChangedLine('a\nb\n', 'a\nb\n'), 0);
  });

  it('ignores CRLF vs LF differences instead of flagging every line', () => {
    assert.strictEqual(primaryChangedLine('a\r\nb\r\nc\r\n', 'a\nb\nX\n'), 2);
  });

  it('handles empty current content', () => {
    assert.strictEqual(primaryChangedLine('a\nb\n', ''), 0);
  });

  it('handles empty baseline with new content', () => {
    assert.strictEqual(primaryChangedLine('', 'a\nb\n'), 0);
  });

  it('jumps to a change deep in a large file rather than staying near the top', () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `line${i}`);
    const baseline = lines.join('\n') + '\n';
    const edited = [...lines];
    edited[999] = 'CHANGED';
    const current = edited.join('\n') + '\n';
    assert.strictEqual(primaryChangedLine(baseline, current), 999);
  });

  it('prefers a larger code change over a one-line import addition (the core ask)', () => {
    const baseline = ['import a', 'function f() {', '  return 1', '}'].join('\n');
    const current = [
      'import a',
      'import b', // a single new import line — would "win" under a naive first-line scan
      'function f() {',
      '  const x = compute()',
      '  const y = transform(x)',
      '  return x + y',
      '}',
    ].join('\n');
    // The import is line 1; the real change (the rewritten function body) starts at line 3
    // and is much larger — that's where the user actually wants to land.
    assert.strictEqual(primaryChangedLine(baseline, current), 3);
  });

  it('still lands on the import when that is the only change', () => {
    const baseline = ['import a', 'function f() {', '  return 1', '}'].join('\n');
    const current = ['import a', 'import b', 'function f() {', '  return 1', '}'].join('\n');
    assert.strictEqual(primaryChangedLine(baseline, current), 1);
  });

  it('falls back to a naive scan for files too large for a full hunk diff', () => {
    // Deliberately exceeds hunks.ts's dense-table cap (product > 4,000,000) so this
    // exercises the firstDivergentLine fallback path, not computeHunks.
    const size = 3000;
    const lines = Array.from({ length: size }, (_, i) => `line${i}`);
    const baseline = lines.join('\n');
    const edited = [...lines];
    edited[500] = 'CHANGED';
    const current = edited.join('\n');
    assert.strictEqual(primaryChangedLine(baseline, current), 500);
  });
});
