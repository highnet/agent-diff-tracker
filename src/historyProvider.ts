import * as vscode from 'vscode';
import { timeAgo as formatTimeAgo } from './timeAgo';
import { BurstStore, burstLabel, type Burst } from './burstHistory';

const globalNow = (): number => Date.now();

class FileItem extends vscode.TreeItem {
  constructor(uri: vscode.Uri, timestamp: number, standalone: boolean, repeatCount: number) {
    super(uri.path.split('/').pop() ?? uri.fsPath, vscode.TreeItemCollapsibleState.None);
    const relativePath = vscode.workspace.asRelativePath(uri, false);
    const dir = relativePath.includes('/') ? relativePath.slice(0, relativePath.lastIndexOf('/')) : '';
    const repeat = repeatCount > 1 ? `edited ×${repeatCount}` : '';
    const parts = [dir, repeat, standalone ? formatTimeAgo(timestamp, globalNow()) : ''].filter(Boolean);
    this.description = parts.join(' · ');
    this.tooltip = relativePath;
    this.resourceUri = uri;
    this.iconPath = vscode.ThemeIcon.File;
    this.contextValue = 'agentDiffTracker.historyItem';
    this.command = {
      command: 'agentDiffTracker.openHistoryItem',
      title: 'Open Diff',
      arguments: [uri],
    };
  }
}

class BurstNode extends vscode.TreeItem {
  constructor(public readonly burst: Burst<vscode.Uri>, index: number) {
    super(burstLabel(burst.items.length, burst.repeatCount), vscode.TreeItemCollapsibleState.Collapsed);
    this.description = formatTimeAgo(burst.timestamp, globalNow());
    this.iconPath = new vscode.ThemeIcon('zap');
    this.contextValue = 'agentDiffTracker.burst';
    // Timestamp alone can collide if two bursts flush within the same ms; index disambiguates.
    this.id = `burst-${burst.timestamp}-${index}`;
  }
}

type HistoryNode = BurstNode | FileItem;

class HistoryProvider implements vscode.TreeDataProvider<HistoryNode>, vscode.Disposable {
  private readonly store = new BurstStore<vscode.Uri>((uri) => uri.toString());
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  // Keeps "3m ago"-style descriptions current without user action.
  private readonly refreshInterval = setInterval(() => this.onDidChangeTreeDataEmitter.fire(), 60_000);

  addBurst(uris: readonly vscode.Uri[], maxBursts: number): void {
    this.store.add(uris, globalNow(), maxBursts);
    this.onDidChangeTreeDataEmitter.fire();
  }

  clear(): void {
    this.store.clear();
    this.onDidChangeTreeDataEmitter.fire();
  }

  dispose(): void {
    clearInterval(this.refreshInterval);
  }

  getTreeItem(element: HistoryNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: HistoryNode): HistoryNode[] {
    if (element instanceof BurstNode) {
      return element.burst.items.map((uri) => new FileItem(uri, element.burst.timestamp, false, 1));
    }
    if (element) return [];

    // Single-file bursts render flat; multi-file bursts get a collapsible node (collapsed
    // by default so browsing history doesn't dump every file in every burst on screen).
    return this.store
      .list()
      .map((burst, index) =>
        burst.items.length === 1
          ? new FileItem(burst.items[0], burst.timestamp, true, burst.repeatCount)
          : new BurstNode(burst, index),
      );
  }
}

export { HistoryProvider };
