import * as vscode from 'vscode';

type HistoryEntry = {
  uri: vscode.Uri;
  timestamp: number;
  burstSize: number;
};

class HistoryItem extends vscode.TreeItem {
  constructor(public readonly entry: HistoryEntry) {
    super(entry.uri.path.split('/').pop() ?? entry.uri.fsPath, vscode.TreeItemCollapsibleState.None);
    this.description = `${timeAgo(entry.timestamp)}${entry.burstSize > 1 ? ` · batch of ${entry.burstSize}` : ''}`;
    this.tooltip = vscode.workspace.asRelativePath(entry.uri, false);
    this.iconPath = new vscode.ThemeIcon('diff');
    this.command = {
      command: 'agentDiffTracker.openHistoryItem',
      title: 'Open Diff',
      arguments: [entry.uri],
    };
  }
}

const timeAgo = (timestamp: number): string => {
  const seconds = Math.max(0, Math.round((globalNow() - timestamp) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
};

const globalNow = (): number => Date.now();

class HistoryProvider implements vscode.TreeDataProvider<HistoryItem> {
  private entries: HistoryEntry[] = [];
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

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

  getTreeItem(element: HistoryItem): vscode.TreeItem {
    return element;
  }

  getChildren(): HistoryItem[] {
    return this.entries.map((entry) => new HistoryItem(entry));
  }
}

export { HistoryProvider };
