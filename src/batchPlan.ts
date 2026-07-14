type BatchPlan = {
  /** Number of files (from the front of the batch) to auto-open diffs for. */
  openCount: number;
  /** Files beyond openCount — recorded in history only, surfaced via a status message. */
  overflowCount: number;
};

/**
 * Decides how many of a batch's files to auto-open, tolerating nonsense config
 * values (negative, zero, NaN, fractional) by clamping rather than misbehaving.
 */
const planBatch = (batchSize: number, minBurstFiles: number, maxAutoOpen: number): BatchPlan => {
  const min = Number.isFinite(minBurstFiles) ? Math.max(1, Math.floor(minBurstFiles)) : 1;
  const max = Number.isFinite(maxAutoOpen) ? Math.max(1, Math.floor(maxAutoOpen)) : 1;
  if (batchSize < min) return { openCount: 0, overflowCount: 0 };
  const openCount = Math.min(batchSize, max);
  return { openCount, overflowCount: batchSize - openCount };
};

/** Clamps the debounce setting to a sane range so a typo can't freeze or spam the UI. */
const clampDebounceMs = (value: number): number => {
  if (!Number.isFinite(value)) return 400;
  return Math.min(10_000, Math.max(50, Math.floor(value)));
};

export { planBatch, clampDebounceMs, type BatchPlan };
