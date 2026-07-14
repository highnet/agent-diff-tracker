type Burst<T> = {
  timestamp: number;
  items: readonly T[];
};

/**
 * History as a list of change bursts (one per debounce flush), newest first.
 * Generic over the item type so it stays unit-testable without the vscode API.
 */
class BurstStore<T> {
  private bursts: Burst<T>[] = [];

  add(items: readonly T[], timestamp: number, maxBursts: number): void {
    if (items.length === 0) return;
    this.bursts.unshift({ timestamp, items: [...items] });
    const cap = Number.isFinite(maxBursts) ? Math.max(1, Math.floor(maxBursts)) : 1;
    if (this.bursts.length > cap) this.bursts.length = cap;
  }

  clear(): void {
    this.bursts = [];
  }

  list(): readonly Burst<T>[] {
    return this.bursts;
  }
}

const burstLabel = (fileCount: number): string => (fileCount === 1 ? '1 file' : `${fileCount} files`);

export { BurstStore, burstLabel, type Burst };
