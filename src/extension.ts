import * as vscode from 'vscode';
import { HistoryProvider } from './historyProvider';
import { shouldIgnorePath } from './matching';
import { shouldAutoOpen, clampDebounceMs } from './batchPlan';
import { primaryChangedLine } from './firstChange';

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

/** Returns the HEAD content of the file, or undefined when there is no baseline (untracked). */
const getGitBaseline = async (uri: vscode.Uri): Promise<string | undefined> => {
  if (!gitApi) return undefined;
  const repo = gitApi.getRepository(uri);
  if (!repo) return undefined;
  const relativePath = uri.fsPath.slice(repo.rootUri.fsPath.length).replace(/^[/\\]/, '');
  try {
    return await repo.show('HEAD', relativePath);
  } catch {
    return undefined;
  }
};

// Empty-document scheme used as the left side when a file has no git baseline
// (untracked/new), so new files still open as a labeled all-added diff instead
// of a bare editor tab.
const EMPTY_SCHEME = 'agent-diff-tracker-empty';

const toEmptyBaselineUri = (uri: vscode.Uri): vscode.Uri =>
  uri.with({ scheme: EMPTY_SCHEME, query: '' });

type OpenDiffOptions = {
  // True for explicit user navigation (history clicks, "show latest") — the diff should
  // take keyboard focus. Auto-opens leave focus alone per the preserveFocus setting.
  takeFocus: boolean;
};

const openDiffForUri = async (uri: vscode.Uri, options: OpenDiffOptions): Promise<void> => {
  const config = vscode.workspace.getConfiguration('agentDiffTracker');
  const preserveFocus = options.takeFocus ? false : config.get<boolean>('preserveFocus', true);
  const fileName = uri.path.split('/').pop() ?? uri.fsPath;

  const baseline = await getGitBaseline(uri);
  // Untracked/new files diff against an empty baseline so every change — new file or
  // edit — opens the same labeled diff tab.
  const leftUri = baseline !== undefined ? toGitHeadUri(uri) : toEmptyBaselineUri(uri);

  // Read from disk rather than the TextDocument: after an external change the
  // document model reloads asynchronously and can still hold stale content here.
  let current: string;
  try {
    current = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  } catch {
    return; // unreadable — nothing sensible to show
  }

  // Always a preview tab: only one "Agent Diff Tracker" diff exists at a time, and
  // opening the next one replaces it — VS Code's native preview mechanic. A user who
  // wants to keep a specific diff around can pin its tab, which takes it out of the
  // preview slot so the next auto-open opens a fresh tab instead of replacing it.
  await vscode.commands.executeCommand(
    'vscode.diff',
    leftUri,
    uri,
    `${fileName} (Agent Diff Tracker)`,
    { preview: true, preserveFocus },
  );

  // Aim the cursor at the first changed line via the editor API — it works on
  // unfocused editors, so no focus-stealing/restoring gymnastics are needed (an
  // earlier restore-focus approach could hide or replace the diff tab it had
  // just opened when the previous editor shared the same editor group).
  const line = primaryChangedLine(baseline, current);
  const aim = () => {
    const editor = vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === uri.toString());
    if (!editor) return;
    const clamped = Math.min(line, Math.max(0, editor.document.lineCount - 1));
    const position = new vscode.Position(clamped, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  };
  aim();
  // The on-disk change reaches the already-open TextDocument asynchronously, and that
  // reload restores the editor's previous view state — clobbering the aim above. Re-aim
  // whenever this document changes during a short settle window.
  const reAim = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document.uri.toString() === uri.toString()) aim();
  });
  setTimeout(() => reAim.dispose(), 1500);
};

const flushBatch = async (): Promise<void> => {
  const batch = pendingBatch;
  pendingBatch = [];
  if (batch.length === 0) return;

  const config = vscode.workspace.getConfiguration('agentDiffTracker');
  const maxHistory = config.get<number>('maxHistoryEntries', 50);

  historyProvider.addBurst(batch, maxHistory);
  lastChangedUri = batch[batch.length - 1];

  const fileNames = batch.map((uri) => uri.path.split('/').pop() ?? uri.fsPath);
  statusBarItem.text =
    batch.length > 1 ? `$(diff) Watching: ${batch.length} files changed` : `$(diff) Watching: ${fileNames[0]}`;

  if (!shouldAutoOpen(batch.length, config.get<number>('minBurstFilesToAutoOpen', 1))) return;

  // Only the most recent file gets the (single, reusable) diff tab — earlier files in
  // the same burst are still recorded in history above, just not opened, since opening
  // them in sequence would only flash through each one and land on this one anyway.
  await openDiffForUri(batch[batch.length - 1], { takeFocus: false });
  if (batch.length > 1) {
    void vscode.window.setStatusBarMessage(
      `Agent Diff Tracker: ${batch.length - 1} more file(s) in this burst — see History view`,
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
    vscode.workspace.registerTextDocumentContentProvider(EMPTY_SCHEME, { provideTextDocumentContent: () => '' }),
    vscode.commands.registerCommand('agentDiffTracker.toggle', toggleWatching),
    vscode.commands.registerCommand('agentDiffTracker.showLatest', () => {
      // Prefer the still-pending batch (freshest), fall back to the last flushed change.
      const latest = pendingBatch[pendingBatch.length - 1] ?? lastChangedUri;
      if (latest) void openDiffForUri(latest, { takeFocus: true });
      else void vscode.window.showInformationMessage('Agent Diff Tracker: no file changes seen yet.');
    }),
    vscode.commands.registerCommand('agentDiffTracker.openHistoryItem', (uri: vscode.Uri) => {
      void openDiffForUri(uri, { takeFocus: true });
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
