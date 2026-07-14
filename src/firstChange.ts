/**
 * Line index (0-based) of the first difference between a baseline and the current
 * content. Used to aim the diff editor's cursor without focus-dependent commands.
 * A missing baseline (untracked file) means everything is new — line 0.
 */
const firstChangedLine = (baseline: string | undefined, current: string): number => {
  if (baseline === undefined) return 0;
  const a = baseline.replace(/\r/g, '').split('\n');
  const b = current.replace(/\r/g, '').split('\n');
  const common = Math.min(a.length, b.length);
  for (let i = 0; i < common; i++) {
    if (a[i] !== b[i]) return i;
  }
  if (a.length === b.length) return 0; // identical — nothing to aim at
  // Pure append or truncation: first change is just past the common prefix.
  return Math.max(0, Math.min(common, b.length - 1));
};

export { firstChangedLine };
