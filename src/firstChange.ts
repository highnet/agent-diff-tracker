import { computeHunks } from './hunks';

/** Naive line-by-line scan used when the file is too large for a full diff (see hunks.ts). */
const firstDivergentLine = (a: readonly string[], b: readonly string[]): number => {
  const common = Math.min(a.length, b.length);
  for (let i = 0; i < common; i++) {
    if (a[i] !== b[i]) return i;
  }
  if (a.length === b.length) return 0; // identical
  return Math.max(0, Math.min(common, b.length - 1));
};

/**
 * Line index (0-based) to aim the diff editor's cursor at. Targets the largest changed
 * hunk (most added/removed lines) rather than literally the first differing line — an
 * agent that adds one import line and rewrites 40 lines of logic elsewhere should land
 * on the logic change, not get stuck staring at the import. Ties go to the earliest hunk.
 * A missing baseline (untracked file) means everything is new — line 0.
 */
const primaryChangedLine = (baseline: string | undefined, current: string): number => {
  if (baseline === undefined) return 0;
  const a = baseline.replace(/\r/g, '').split('\n');
  const b = current.replace(/\r/g, '').split('\n');

  const hunks = computeHunks(a, b);
  if (!hunks) return firstDivergentLine(a, b);
  if (hunks.length === 0) return 0; // identical content

  let best = hunks[0];
  for (const hunk of hunks) {
    if (hunk.changeSize > best.changeSize) best = hunk;
  }
  return Math.max(0, Math.min(best.bStart, b.length - 1));
};

export { primaryChangedLine };
