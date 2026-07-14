import * as vscode from 'vscode';

let watcher: vscode.FileSystemWatcher | undefined;
let statusBarItem: vscode.StatusBarItem;
let debounceTimer: NodeJS.Timeout | undefined;
let pendingUri: vscode.Uri | undefined;
let isWatching = true;

const toGitHeadUri = (uri: vscode.Uri): vscode.Uri => {
  return uri.with({
    scheme: 'git',
    path: uri.path,
    query: JSON.stringify({ path: uri.fsPath, ref: 'HEAD' }),
  });
};

const shouldIgnore = (uri: vscode.Uri, patterns: string[]): boolean => {
  const relative = vscode.workspace.asRelativePath(uri, false);
  return patterns.some((pattern) => {
    const regex = new RegExp(
      '^' +
        pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*') +
        '$',
    );
    return regex.test(relative);
  });
};

const openDiffForUri = async (uri: vscode.Uri): Promise<void> => {
  const config = vscode.workspace.getConfiguration('agentDiffTracker');
  const preserveFocus = config.get<boolean>('preserveFocus', true);
  const fileName = uri.path.split('/').pop() ?? uri.fsPath;

  const leftUri = toGitHeadUri(uri);

  try {
    await vscode.commands.executeCommand(
      'vscode.diff',
      leftUri,
      uri,
      `${fileName} (Agent Diff Tracker)`,
      { preview: true, preserveFocus },
    );
    statusBarItem.text = `$(diff) Watching: ${fileName}`;
  } catch {
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: true, preserveFocus });
    statusBarItem.text = `$(diff) Watching: ${fileName} (no baseline)`;
  }
};

const scheduleDiff = (uri: vscode.Uri): void => {
  if (!isWatching) return;
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

const activate = (context: vscode.ExtensionContext): void => {
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
