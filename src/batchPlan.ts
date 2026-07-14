/**
 * Whether a batch of changed files is big enough to auto-open a diff at all,
 * tolerating nonsense config values (negative, zero, NaN, fractional) by
 * clamping rather than misbehaving.
 */
const shouldAutoOpen = (batchSize: number, minBurstFiles: number): boolean => {
  const min = Number.isFinite(minBurstFiles) ? Math.max(1, Math.floor(minBurstFiles)) : 1;
  return batchSize >= min;
};

/** Clamps the debounce setting to a sane range so a typo can't freeze or spam the UI. */
const clampDebounceMs = (value: number): number => {
  if (!Number.isFinite(value)) return 400;
  return Math.min(10_000, Math.max(50, Math.floor(value)));
};

export { shouldAutoOpen, clampDebounceMs };
