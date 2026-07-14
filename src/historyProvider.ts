import * as vscode from 'vscode';
import { timeAgo as formatTimeAgo } from './timeAgo';
import { bucketLabel, BUCKET_ORDER } from './historyGrouping';

type HistoryEntry = {
  uri: vscode.Uri;
  timestamp: number;
  burstSize: number;
};

const globalNow = (): number => Date.now();

class HistoryItem extends vscode.TreeItem {
  constructor(public readonly entry: HistoryEntry) {
    super(entry.uri.path.split('/').pop() ?? entry.uri.fsPath, vscode.TreeItemCollapsibleState.None);
    const relativePath = vscode.workspace.asRelativePath(entry.uri, false);
    const dir = relativePath.includes('/') ? relativePath.slice(0, relativePath.lastIndexOf('/')) : '';
    this.description = `${dir ? `${dir} · ` : ''}${formatTimeAgo(entry.timestamp, globalNow())}${entry.burstSize > 1 ? ` · batch of ${entry.burstSize}` : ''}`;
    this.tooltip = relativePath;
    this.resourceUri = entry.uri;
    this.iconPath = vscode.ThemeIcon.File;
    this.contextValue = 'agentDiffTracker.historyItem';
    this.command = {
      command: 'agentDiffTracker.openHistoryItem',
      title: 'Open Diff',
      arguments: [entry.uri],
    };
  }
}

class HistoryGroup extends vscode.TreeItem {
  constructor(
    public readonly label: (typeof BUCKET_ORDER)[number],
    public readonly entries: HistoryEntry[],
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${entries.length}`;
    this.contextValue = 'agentDiffTracker.historyGroup';
  }
}

type HistoryNode = HistoryGroup | HistoryItem;

class HistoryProvider implements vscode.TreeDataProvider<HistoryNode>, vscode.Disposable {
  private entries: HistoryEntry[] = [];
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  // Keeps "3m ago"-style descriptions and Today/Yesterday buckets current without user action.
  private readonly refreshInterval = setInterval(() => this.refreshTimestamps(), 60_000);

  add(uri: vscode.Uri, burstSize: number, maxEntries: number): void {
    this.entries = this.entries.filter((entry) => entry.uri.fsPath !== uri.fsPath);
    this.entries.unshift({ uri, timestamp: globalNow(), burstSize });
    if (this.entries.length > maxEntries) this.entries.length = maxEntries;
    this.onDidChangeTreeDataEmitter.fire();
  }

  clear(): void {
    this.entries = [];
    this.onDidChangeTreeDataEmitter.fire();
  }

  refreshTimestamps(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  dispose(): void {
    clearInterval(this.refreshInterval);
  }

  getTreeItem(element: HistoryNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: HistoryNode): HistoryNode[] {
    if (element instanceof HistoryGroup) {
      return element.entries.map((entry) => new HistoryItem(entry));
    }
    if (element) return [];

    const now = globalNow();
    const grouped = new Map<string, HistoryEntry[]>();
    for (const entry of this.entries) {
      const bucket = bucketLabel(entry.timestamp, now);
      const existing = grouped.get(bucket);
      if (existing) existing.push(entry);
      else grouped.set(bucket, [entry]);
    }

    return BUCKET_ORDER.filter((bucket) => grouped.has(bucket)).map(
      (bucket) => new HistoryGroup(bucket, grouped.get(bucket)!),
    );
  }
}

export { HistoryProvider };
