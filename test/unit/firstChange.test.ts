import * as assert from 'assert';
import { firstChangedLine } from '../../src/firstChange';

describe('firstChangedLine', () => {
  it('returns 0 for untracked files (no baseline) — everything is new', () => {
    assert.strictEqual(firstChangedLine(undefined, 'a\nb\n'), 0);
  });

  it('finds an in-place edit', () => {
    assert.strictEqual(firstChangedLine('a\nb\nc\n', 'a\nX\nc\n'), 1);
  });

  it('finds a pure append (first new line just past the baseline)', () => {
    assert.strictEqual(firstChangedLine('line1\n', 'line1\nline2\n'), 1);
  });

  it('finds a change on the first line', () => {
    assert.strictEqual(firstChangedLine('a\nb\n', 'X\nb\n'), 0);
  });

  it('handles truncation (lines deleted from the end)', () => {
    assert.strictEqual(firstChangedLine('a\nb\nc\n', 'a\n'), 1);
  });

  it('returns 0 for identical content instead of a bogus position', () => {
    assert.strictEqual(firstChangedLine('a\nb\n', 'a\nb\n'), 0);
  });

  it('ignores CRLF vs LF differences instead of flagging every line', () => {
    assert.strictEqual(firstChangedLine('a\r\nb\r\nc\r\n', 'a\nb\nX\n'), 2);
  });

  it('handles empty current content', () => {
    assert.strictEqual(firstChangedLine('a\nb\n', ''), 0);
  });

  it('handles empty baseline with new content', () => {
    assert.strictEqual(firstChangedLine('', 'a\nb\n'), 0);
  });

  it('finds a change deep in a large file (not just near the top)', () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `line${i}`);
    const baseline = lines.join('\n') + '\n';
    const edited = [...lines];
    edited[999] = 'CHANGED';
    const current = edited.join('\n') + '\n';
    assert.strictEqual(firstChangedLine(baseline, current), 999);
  });

  it('finds only the first of several changes deep in a large file', () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `line${i}`);
    const baseline = lines.join('\n') + '\n';
    const edited = [...lines];
    edited[999] = 'CHANGED';
    edited[1500] = 'ALSO CHANGED';
    const current = edited.join('\n') + '\n';
    assert.strictEqual(firstChangedLine(baseline, current), 999);
  });
});
