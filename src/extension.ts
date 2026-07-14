import * as vscode from 'vscode';
import { HistoryProvider } from './historyProvider';

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
let isWatching = true;
let gitApi: GitApi | undefined;
let historyProvider: HistoryProvider;

const HARD_EXCLUDE_SEGMENTS = new Set(['.git', 'node_modules', '.next', '.impeccable', 'dist', 'out', 'build']);
const HARD_EXCLUDE_SUFFIXES = ['.tsbuildinfo', '.log'];

const DOUBLE_STAR_SLASH = ' DSSLASH ';
const SLASH_DOUBLE_STAR = ' SLASHDS ';
const DOUBLE_STAR = ' DS ';
const SINGLE_STAR = ' STAR ';
const QUESTION_MARK = ' QM ';

const globToRegex = (pattern: string): RegExp => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const withPlaceholders = escaped
    .replace(/\*\*\//g, DOUBLE_STAR_SLASH)
    .replace(/\/\*\*/g, SLASH_DOUBLE_STAR)
    .replace(/\*\*/g, DOUBLE_STAR)
    .replace(/\*/g, SINGLE_STAR)
    .replace(/\?/g, QUESTION_MARK);
  const withRegexSyntax = withPlaceholders
    .split(DOUBLE_STAR_SLASH).join('(?:.*/)?')
    .split(SLASH_DOUBLE_STAR).join('(?:/.*)?')
    .split(DOUBLE_STAR).join('.*')
    .split(SINGLE_STAR).join('[^/]*')
    .split(QUESTION_MARK).join('.');
  return new RegExp(`^${withRegexSyntax}$`);
};

const shouldIgnore = (uri: vscode.Uri, patterns: string[]): boolean => {
  const relative = vscode.workspace.asRelativePath(uri, false);
  const segments = relative.split('/');
  if (segments.some((segment) => HARD_EXCLUDE_SEGMENTS.has(segment))) return true;
  if (HARD_EXCLUDE_SUFFIXES.some((suffix) => relative.endsWith(suffix))) return true;
  return patterns.some((pattern) => globToRegex(pattern).test(relative));
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

const openDiffForUri = async (uri: vscode.Uri, preview: boolean): Promise<void> => {
  const config = vscode.workspace.getConfiguration('agentDiffTracker');
  const preserveFocus = config.get<boolean>('preserveFocus', true);
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
      { preview, preserveFocus: false },
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
    await vscode.window.showTextDocument(doc, { preview, preserveFocus });
  }
};

const flushBatch = async (): Promise<void> => {
  const batch = pendingBatch;
  pendingBatch = [];
  if (batch.length === 0) return;

  const config = vscode.workspace.getConfiguration('agentDiffTracker');
  const minBurstFiles = config.get<number>('minBurstFilesToAutoOpen', 1);
  const maxAutoOpen = config.get<number>('maxAutoOpenFiles', 4);
  const maxHistory = config.get<number>('maxHistoryEntries', 50);

  for (const uri of batch) {
    historyProvider.add(uri, batch.length, maxHistory);
  }

  const fileNames = batch.map((uri) => uri.path.split('/').pop() ?? uri.fsPath);
  statusBarItem.text =
    batch.length > 1 ? `$(diff) Watching: ${batch.length} files changed` : `$(diff) Watching: ${fileNames[0]}`;

  if (batch.length < minBurstFiles) return;

  const toOpen = batch.slice(0, maxAutoOpen);
  for (const [index, uri] of toOpen.entries()) {
    await openDiffForUri(uri, toOpen.length === 1 && index === 0);
  }
  if (batch.length > maxAutoOpen) {
    void vscode.window.setStatusBarMessage(
      `Agent Diff Tracker: ${batch.length - maxAutoOpen} more file(s) changed — see History view`,
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

  const debounceMs = config.get<number>('debounceMs', 400);
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
    vscode.commands.registerCommand('agentDiffTracker.toggle', toggleWatching),
    vscode.commands.registerCommand('agentDiffTracker.showLatest', () => {
      const [latest] = pendingBatch.length > 0 ? pendingBatch : [];
      if (latest) void openDiffForUri(latest, true);
      else void vscode.window.showInformationMessage('Agent Diff Tracker: no file changes seen yet.');
    }),
    vscode.commands.registerCommand('agentDiffTracker.openHistoryItem', (uri: vscode.Uri) => {
      void openDiffForUri(uri, true);
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
