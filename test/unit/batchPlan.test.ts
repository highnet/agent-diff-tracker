import * as assert from 'assert';
import { shouldAutoOpen, clampDebounceMs } from '../../src/batchPlan';

describe('shouldAutoOpen', () => {
  it('opens when the batch meets the burst threshold', () => {
    assert.strictEqual(shouldAutoOpen(1, 1), true);
    assert.strictEqual(shouldAutoOpen(3, 1), true);
    assert.strictEqual(shouldAutoOpen(2, 2), true);
  });

  it('does not open when the batch is below the burst threshold', () => {
    assert.strictEqual(shouldAutoOpen(1, 2), false);
  });

  it('clamps a zero or negative minBurstFiles to 1 instead of never opening', () => {
    assert.strictEqual(shouldAutoOpen(1, 0), true);
    assert.strictEqual(shouldAutoOpen(1, -5), true);
  });

  it('tolerates NaN config by falling back to a safe minimum', () => {
    assert.strictEqual(shouldAutoOpen(1, NaN), true);
    assert.strictEqual(shouldAutoOpen(0, NaN), false);
  });

  it('floors fractional config values', () => {
    assert.strictEqual(shouldAutoOpen(1, 1.9), true);
    assert.strictEqual(shouldAutoOpen(2, 1.9), true);
  });
});

describe('clampDebounceMs', () => {
  it('passes through sane values', () => {
    assert.strictEqual(clampDebounceMs(400), 400);
  });

  it('clamps too-small values up to 50ms', () => {
    assert.strictEqual(clampDebounceMs(0), 50);
    assert.strictEqual(clampDebounceMs(-100), 50);
  });

  it('clamps runaway values down to 10s', () => {
    assert.strictEqual(clampDebounceMs(999_999), 10_000);
  });

  it('falls back to the default for NaN/Infinity', () => {
    assert.strictEqual(clampDebounceMs(NaN), 400);
    assert.strictEqual(clampDebounceMs(Infinity), 400);
  });
});
