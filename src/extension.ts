import * as vscode from 'vscode';

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
let debounceTimer: NodeJS.Timeout | undefined;
let pendingUri: vscode.Uri | undefined;
let isWatching = true;
let gitApi: GitApi | undefined;

const HARD_EXCLUDE_SEGMENTS = new Set(['.git', 'node_modules']);

const globToRegex = (pattern: string): RegExp => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const withDoubleStarSlash = escaped
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\/\*\*/g, '(?:/.*)?')
    .replace(/\*\*/g, '.*');
  const withStars = withDoubleStarSlash.replace(/\*/g, '[^/]*').replace(/\?/g, '.');
  return new RegExp(`^${withStars}$`);
};

const shouldIgnore = (uri: vscode.Uri, patterns: string[]): boolean => {
  const relative = vscode.workspace.asRelativePath(uri, false);
  const segments = relative.split('/');
  if (segments.some((segment) => HARD_EXCLUDE_SEGMENTS.has(segment))) return true;
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

const openDiffForUri = async (uri: vscode.Uri): Promise<void> => {
  const config = vscode.workspace.getConfiguration('agentDiffTracker');
  const preserveFocus = config.get<boolean>('preserveFocus', true);
  const fileName = uri.path.split('/').pop() ?? uri.fsPath;

  const canDiff = await hasGitBaseline(uri);

  if (canDiff) {
    await vscode.commands.executeCommand(
      'vscode.diff',
      toGitHeadUri(uri),
      uri,
      `${fileName} (Agent Diff Tracker)`,
      { preview: true, preserveFocus },
    );
    statusBarItem.text = `$(diff) Watching: ${fileName}`;
  } else {
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: true, preserveFocus });
    statusBarItem.text = `$(diff) Watching: ${fileName} (no baseline)`;
  }
};

const scheduleDiff = (uri: vscode.Uri): void => {
  if (!isWatching) return;
  if (uri.scheme !== 'file') return;
  const config = vscode.workspace.getConfiguration('agentDiffTracker');
  const excludePatterns = config.get<string[]>('exclude', []);
  if (shouldIgnore(uri, excludePatterns)) return;

  pendingUri = uri;
  const debounceMs = config.get<number>('debounceMs', 400);

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (pendingUri) void openDiffForUri(pendingUri);
  }, debounceMs);
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

  watcher = vscode.workspace.createFileSystemWatcher('**/*');
  watcher.onDidChange(scheduleDiff);
  watcher.onDidCreate(scheduleDiff);

  context.subscriptions.push(
    statusBarItem,
    watcher,
    vscode.commands.registerCommand('agentDiffTracker.toggle', toggleWatching),
    vscode.commands.registerCommand('agentDiffTracker.showLatest', () => {
      if (pendingUri) void openDiffForUri(pendingUri);
      else void vscode.window.showInformationMessage('Agent Diff Tracker: no file changes seen yet.');
    }),
  );
};

const deactivate = (): void => {
  if (debounceTimer) clearTimeout(debounceTimer);
};

export { activate, deactivate };
