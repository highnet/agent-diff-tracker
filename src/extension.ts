import * as vscode from 'vscode';
import { HistoryProvider } from './historyProvider';
import { shouldIgnorePath } from './matching';
import { planBatch, clampDebounceMs } from './batchPlan';

type GitApi = {
  repositories: GitRepository[];
  getRepository(uri: vscode.Uri): GitRepository | null;
};

type GitRepository = {
  rootUri: vscode.Uri;
  show(ref: string, path: string): Promise<string>;
};

let watcher: vscode.FileSystemWatcher | undefined;
let statusBarItem: vscode.StatusBarItem;
let batchTimer: ReturnType<typeof setTimeout> | undefined;
let pendingBatch: vscode.Uri[] = [];
let lastChangedUri: vscode.Uri | undefined;
let isWatching = true;
let gitApi: GitApi | undefined;
let historyProvider: HistoryProvider;

const shouldIgnore = (uri: vscode.Uri, patterns: string[]): boolean => {
  const relative = vscode.workspace.asRelativePath(uri, false);
  return shouldIgnorePath(relative, patterns);
};

const toGitHeadUri = (uri: vscode.Uri): vscode.Uri => {
  return uri.with({
    scheme: 'git',
    path: uri.path,
    query: JSON.stringify({ path: uri.fsPath, ref: 'HEAD' }),
  });
};

const hasGitBaseline = async (uri: vscode.Uri): Promise<boolean> => {
  if (!gitApi) return false;
  const repo = gitApi.getRepository(uri);
  if (!repo) return false;
  const relativePath = uri.fsPath.slice(repo.rootUri.fsPath.length).replace(/^[/\\]/, '');
  try {
    await repo.show('HEAD', relativePath);
    return true;
  } catch {
    return false;
  }
};

type OpenDiffOptions = {
  preview: boolean;
  // When false, the diff becomes and stays the active editor instead of snapping focus
  // back to whatever was active before — used for explicit user navigation (history
  // clicks, "show latest") so exploring the history doesn't get yanked away.
  restoreFocusAfter: boolean;
};

const openDiffForUri = async (uri: vscode.Uri, options: OpenDiffOptions): Promise<void> => {
  const config = vscode.workspace.getConfiguration('agentDiffTracker');
  const preserveFocus = options.restoreFocusAfter && config.get<boolean>('preserveFocus', true);
  const fileName = uri.path.split('/').pop() ?? uri.fsPath;

  const canDiff = await hasGitBaseline(uri);
  const previouslyActive = vscode.window.activeTextEditor;

  if (canDiff) {
    // Open focused (preserveFocus: false) so the diff editor becomes active — required for
    // compareEditor.nextChange to target it and jump to the first actual edit, not line 1.
    await vscode.commands.executeCommand(
      'vscode.diff',
      toGitHeadUri(uri),
      uri,
      `${fileName} (Agent Diff Tracker)`,
      { preview: options.preview, preserveFocus: false },
    );
    try {
      await vscode.commands.executeCommand('workbench.action.compareEditor.nextChange');
    } catch {
      // No-op: some file types (binary, no changes yet) have nothing to navigate to.
    }
    if (preserveFocus && previouslyActive) {
      await vscode.window.showTextDocument(previouslyActive.document, {
        viewColumn: previouslyActive.viewColumn,
        preserveFocus: false,
      });
    }
  } else {
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: options.preview, preserveFocus });
  }
};

const flushBatch = async (): Promise<void> => {
  const batch = pendingBatch;
  pendingBatch = [];
  if (batch.length === 0) return;

  const config = vscode.workspace.getConfiguration('agentDiffTracker');
  const maxHistory = config.get<number>('maxHistoryEntries', 50);

  for (const uri of batch) {
    historyProvider.add(uri, batch.length, maxHistory);
  }
  lastChangedUri = batch[batch.length - 1];

  const fileNames = batch.map((uri) => uri.path.split('/').pop() ?? uri.fsPath);
  statusBarItem.text =
    batch.length > 1 ? `$(diff) Watching: ${batch.length} files changed` : `$(diff) Watching: ${fileNames[0]}`;

  const plan = planBatch(
    batch.length,
    config.get<number>('minBurstFilesToAutoOpen', 1),
    config.get<number>('maxAutoOpenFiles', 4),
  );
  if (plan.openCount === 0) return;

  const toOpen = batch.slice(0, plan.openCount);
  for (const [index, uri] of toOpen.entries()) {
    await openDiffForUri(uri, { preview: toOpen.length === 1 && index === 0, restoreFocusAfter: true });
  }
  if (plan.overflowCount > 0) {
    void vscode.window.setStatusBarMessage(
      `Agent Diff Tracker: ${plan.overflowCount} more file(s) changed — see History view`,
      4000,
    );
  }
};

const scheduleDiff = (uri: vscode.Uri): void => {
  if (!isWatching) return;
  if (uri.scheme !== 'file') return;
  const config = vscode.workspace.getConfiguration('agentDiffTracker');
  const excludePatterns = config.get<string[]>('exclude', []);
  if (shouldIgnore(uri, excludePatterns)) return;

  if (!pendingBatch.some((existing) => existing.fsPath === uri.fsPath)) {
    pendingBatch.push(uri);
  }

  const debounceMs = clampDebounceMs(config.get<number>('debounceMs', 400));
  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = setTimeout(() => void flushBatch(), debounceMs);
};

const toggleWatching = (): void => {
  isWatching = !isWatching;
  statusBarItem.text = isWatching ? '$(diff) Agent Diff Tracker: On' : '$(circle-slash) Agent Diff Tracker: Off';
};

const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const gitExtension = vscode.extensions.getExtension('vscode.git');
  if (gitExtension) {
    const exports = await gitExtension.activate();
    gitApi = exports.getAPI(1) as GitApi;
  }

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'agentDiffTracker.toggle';
  statusBarItem.text = '$(diff) Agent Diff Tracker: On';
  statusBarItem.tooltip = 'Click to pause/resume watching for file changes';
  statusBarItem.show();

  historyProvider = new HistoryProvider();
  const historyView = vscode.window.createTreeView('agentDiffTracker.history', {
    treeDataProvider: historyProvider,
  });

  watcher = vscode.workspace.createFileSystemWatcher('**/*');
  watcher.onDidChange(scheduleDiff);
  watcher.onDidCreate(scheduleDiff);

  context.subscriptions.push(
    statusBarItem,
    watcher,
    historyView,
    historyProvider,
    vscode.commands.registerCommand('agentDiffTracker.toggle', toggleWatching),
    vscode.commands.registerCommand('agentDiffTracker.showLatest', () => {
      // Prefer the still-pending batch (freshest), fall back to the last flushed change.
      const latest = pendingBatch[pendingBatch.length - 1] ?? lastChangedUri;
      if (latest) void openDiffForUri(latest, { preview: false, restoreFocusAfter: false });
      else void vscode.window.showInformationMessage('Agent Diff Tracker: no file changes seen yet.');
    }),
    vscode.commands.registerCommand('agentDiffTracker.openHistoryItem', (uri: vscode.Uri) => {
      void openDiffForUri(uri, { preview: false, restoreFocusAfter: false });
    }),
    vscode.commands.registerCommand('agentDiffTracker.clearHistory', () => {
      historyProvider.clear();
    }),
  );
};

const deactivate = (): void => {
  if (batchTimer) clearTimeout(batchTimer);
};

export { activate, deactivate };
