type Hunk = {
  /** Line index in `b` (current content) where this hunk's added lines start. */
  bStart: number;
  /** Number of lines added into `b` by this hunk (0 for a pure deletion). */
  bLength: number;
  /** Total lines added + removed — used to rank hunks by significance. */
  changeSize: number;
};

// Dense LCS table is O(n*m) time/space — fine for typical files, but a huge one (e.g. a
// generated lockfile someone forgot to exclude) could blow memory. Beyond this many
// cells, callers should fall back to a cheaper heuristic instead of calling this.
const MAX_DENSE_CELLS = 4_000_000;

const canComputeHunks = (aLineCount: number, bLineCount: number): boolean => aLineCount * bLineCount <= MAX_DENSE_CELLS;

/**
 * Line-level diff via the classic LCS dynamic-programming table, returning contiguous
 * change regions (hunks) in terms of `b`'s line numbering. Returns undefined when the
 * input is too large for a dense table (see canComputeHunks) — callers should fall back.
 */
const computeHunks = (a: readonly string[], b: readonly string[]): Hunk[] | undefined => {
  const n = a.length;
  const m = b.length;
  if (!canComputeHunks(n, m)) return undefined;
  if (n === 0 && m === 0) return [];

  const dp: Uint32Array[] = new Array(n + 1);
  for (let i = 0; i <= n; i++) dp[i] = new Uint32Array(m + 1);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const hunks: Hunk[] = [];
  let i = 0;
  let j = 0;
  let hunkStart = -1;
  let hunkChangeSize = 0;

  const closeHunk = () => {
    if (hunkStart !== -1) {
      hunks.push({ bStart: hunkStart, bLength: j - hunkStart, changeSize: hunkChangeSize });
      hunkStart = -1;
      hunkChangeSize = 0;
    }
  };

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      closeHunk();
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      if (hunkStart === -1) hunkStart = j;
      hunkChangeSize++;
      i++; // line removed from a
    } else {
      if (hunkStart === -1) hunkStart = j;
      hunkChangeSize++;
      j++; // line added into b
    }
  }
  while (i < n) {
    if (hunkStart === -1) hunkStart = j;
    hunkChangeSize++;
    i++;
  }
  while (j < m) {
    if (hunkStart === -1) hunkStart = j;
    hunkChangeSize++;
    j++;
  }
  closeHunk();

  return hunks;
};

export { computeHunks, canComputeHunks, type Hunk };
