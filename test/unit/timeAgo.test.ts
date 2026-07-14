import * as assert from 'assert';
import { timeAgo } from '../../src/timeAgo';

describe('timeAgo', () => {
  const NOW = 1_000_000_000;

  it('reports "just now" for sub-5-second deltas', () => {
    assert.strictEqual(timeAgo(NOW - 4_000, NOW), 'just now');
  });

  it('reports seconds for deltas under a minute', () => {
    assert.strictEqual(timeAgo(NOW - 30_000, NOW), '30s ago');
  });

  it('reports minutes for deltas under an hour', () => {
    assert.strictEqual(timeAgo(NOW - 5 * 60_000, NOW), '5m ago');
  });

  it('reports hours for deltas of an hour or more', () => {
    assert.strictEqual(timeAgo(NOW - 3 * 3_600_000, NOW), '3h ago');
  });

  it('reports days once past 24 hours instead of piling up hours', () => {
    assert.strictEqual(timeAgo(NOW - 26 * 3_600_000, NOW), '1d ago');
    assert.strictEqual(timeAgo(NOW - 3 * 86_400_000, NOW), '3d ago');
  });

  it('clamps negative deltas (future timestamps) to zero seconds', () => {
    assert.strictEqual(timeAgo(NOW + 10_000, NOW), 'just now');
  });
});
