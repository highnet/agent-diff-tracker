import * as assert from 'assert';
import { computeHunks, canComputeHunks } from '../../src/hunks';

describe('computeHunks', () => {
  it('returns no hunks for identical input', () => {
    assert.deepStrictEqual(computeHunks(['a', 'b'], ['a', 'b']), []);
  });

  it('finds a single in-place edit as one hunk', () => {
    const hunks = computeHunks(['a', 'b', 'c'], ['a', 'X', 'c']);
    assert.strictEqual(hunks?.length, 1);
    assert.strictEqual(hunks![0].bStart, 1);
    assert.strictEqual(hunks![0].bLength, 1);
    assert.strictEqual(hunks![0].changeSize, 2); // 1 removed + 1 added
  });

  it('finds a pure append as a hunk with the added lines', () => {
    const hunks = computeHunks(['a'], ['a', 'b', 'c']);
    assert.strictEqual(hunks?.length, 1);
    assert.strictEqual(hunks![0].bStart, 1);
    assert.strictEqual(hunks![0].bLength, 2);
    assert.strictEqual(hunks![0].changeSize, 2);
  });

  it('finds a pure deletion as a zero-width hunk at the deletion point', () => {
    const hunks = computeHunks(['a', 'b', 'c'], ['a']);
    assert.strictEqual(hunks?.length, 1);
    assert.strictEqual(hunks![0].bStart, 1);
    assert.strictEqual(hunks![0].bLength, 0);
    assert.strictEqual(hunks![0].changeSize, 2);
  });

  it('separates two edits with unchanged lines between them into two hunks', () => {
    const a = ['a', 'b', 'c', 'd', 'e'];
    const b = ['a', 'X', 'c', 'Y', 'e'];
    const hunks = computeHunks(a, b);
    assert.strictEqual(hunks?.length, 2);
    assert.strictEqual(hunks![0].bStart, 1);
    assert.strictEqual(hunks![1].bStart, 3);
  });

  it('reports a larger changeSize for a bigger hunk than a smaller one', () => {
    // One-line insert near the top (an import), a 5-line block changed further down.
    const a = ['import a', 'x1', 'x2', 'x3', 'x4', 'x5'];
    const b = ['import a', 'import b', 'y1', 'y2', 'y3', 'y4', 'y5'];
    const hunks = computeHunks(a, b)!;
    const biggest = hunks.reduce((max, h) => (h.changeSize > max.changeSize ? h : max));
    assert.ok(biggest.changeSize >= 5, `expected the 5-line block to be the biggest hunk, got changeSize ${biggest.changeSize}`);
  });

  it('handles fully disjoint content as one hunk spanning everything', () => {
    const hunks = computeHunks(['a', 'b'], ['x', 'y', 'z']);
    assert.strictEqual(hunks?.length, 1);
    assert.strictEqual(hunks![0].bStart, 0);
    assert.strictEqual(hunks![0].bLength, 3);
  });

  it('handles empty arrays on either side', () => {
    assert.deepStrictEqual(computeHunks([], []), []);
    assert.strictEqual(computeHunks([], ['a', 'b'])?.length, 1);
    assert.strictEqual(computeHunks(['a', 'b'], [])?.length, 1);
  });
});

describe('canComputeHunks', () => {
  it('allows reasonably sized files', () => {
    assert.strictEqual(canComputeHunks(2000, 2000), true);
  });

  it('rejects a pair of files whose product exceeds the dense-table cap', () => {
    assert.strictEqual(canComputeHunks(100_000, 100_000), false);
  });

  it('computeHunks returns undefined when the size guard would reject the input', () => {
    const a = Array.from({ length: 3000 }, (_, i) => `${i}`);
    const b = Array.from({ length: 3000 }, (_, i) => `${i}`);
    // 3000*3000 = 9,000,000 > 4,000,000 cap
    assert.strictEqual(computeHunks(a, b), undefined);
  });
});
