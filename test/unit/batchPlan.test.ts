import * as assert from 'assert';
import { planBatch, clampDebounceMs } from '../../src/batchPlan';

describe('planBatch', () => {
  it('opens every file when the batch fits within maxAutoOpen', () => {
    assert.deepStrictEqual(planBatch(3, 1, 4), { openCount: 3, overflowCount: 0 });
  });

  it('caps at maxAutoOpen and reports the overflow', () => {
    assert.deepStrictEqual(planBatch(10, 1, 4), { openCount: 4, overflowCount: 6 });
  });

  it('opens nothing when the batch is below the burst threshold', () => {
    assert.deepStrictEqual(planBatch(1, 2, 4), { openCount: 0, overflowCount: 0 });
  });

  it('opens when the batch exactly meets the burst threshold', () => {
    assert.deepStrictEqual(planBatch(2, 2, 4), { openCount: 2, overflowCount: 0 });
  });

  it('clamps a zero or negative minBurstFiles to 1 instead of never opening', () => {
    assert.deepStrictEqual(planBatch(1, 0, 4), { openCount: 1, overflowCount: 0 });
    assert.deepStrictEqual(planBatch(1, -5, 4), { openCount: 1, overflowCount: 0 });
  });

  it('clamps a zero or negative maxAutoOpen to 1 instead of opening nothing forever', () => {
    assert.deepStrictEqual(planBatch(3, 1, 0), { openCount: 1, overflowCount: 2 });
    assert.deepStrictEqual(planBatch(3, 1, -1), { openCount: 1, overflowCount: 2 });
  });

  it('tolerates NaN config values by falling back to safe minimums', () => {
    assert.deepStrictEqual(planBatch(2, NaN, NaN), { openCount: 1, overflowCount: 1 });
  });

  it('floors fractional config values', () => {
    assert.deepStrictEqual(planBatch(3, 1.9, 2.9), { openCount: 2, overflowCount: 1 });
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
