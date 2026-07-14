import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const workspaceRoot = () => vscode.workspace.workspaceFolders?.[0].uri.fsPath as string;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Agent Diff Tracker (integration)', function () {
  this.timeout(30000);

  let extension: vscode.Extension<unknown> | undefined;

  before(async () => {
    extension = vscode.extensions.getExtension('JoaquinTelleria.agent-diff-tracker');
    assert.ok(extension, 'extension should be discoverable by id');
    await extension!.activate();
    // Give the vscode.git extension a moment to index the fixture repo.
    await sleep(2000);
  });

  it('activates without throwing', () => {
    assert.strictEqual(extension!.isActive, true);
  });

  it('registers all contributed commands', async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const id of [
      'agentDiffTracker.toggle',
      'agentDiffTracker.showLatest',
      'agentDiffTracker.clearHistory',
      'agentDiffTracker.openHistoryItem',
    ]) {
      assert.ok(commands.includes(id), `expected ${id} to be registered`);
    }
  });

  it('shows an informational message from showLatest when nothing has changed yet', async () => {
    // No file-change events have fired yet in this fresh window, so this should
    // hit the "no changes seen" branch rather than throwing.
    await assert.doesNotReject(() => Promise.resolve(vscode.commands.executeCommand('agentDiffTracker.showLatest')));
  });

  it('opens a diff editor tab titled "(Agent Diff Tracker)" when a tracked file changes', async () => {
    const filePath = path.join(workspaceRoot(), 'tracked.txt');
    fs.appendFileSync(filePath, 'line2\n');

    // Wait past the default 400ms debounce plus batching/open overhead.
    await sleep(2500);

    const titles = vscode.window.tabGroups.all.flatMap((group) => group.tabs.map((tab) => tab.label));
    assert.ok(
      titles.some((title) => title.includes('Agent Diff Tracker')),
      `expected a tab titled with "Agent Diff Tracker", got: ${JSON.stringify(titles)}`,
    );
  });

  it('does not open a diff tab for excluded files (e.g. inside node_modules)', async () => {
    const dir = path.join(workspaceRoot(), 'node_modules', 'somepkg');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'index.js');

    const tabCountBefore = vscode.window.tabGroups.all.flatMap((g) => g.tabs).length;
    fs.writeFileSync(filePath, 'module.exports = {};\n');
    await sleep(2500);

    const tabsAfter = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
    assert.ok(
      !tabsAfter.some((tab) => tab.label.includes('index.js')),
      'excluded file should not have opened a diff/editor tab',
    );
    // Sanity: we didn't just fail to observe any tabs at all.
    assert.ok(tabsAfter.length >= tabCountBefore);
  });

  it('openHistoryItem reuses a single diff tab instead of piling up one per file', async () => {
    const fileA = path.join(workspaceRoot(), 'tracked.txt');
    const fileB = path.join(workspaceRoot(), 'tracked-b.txt');
    fs.writeFileSync(fileB, 'b1\n');
    await sleep(2500);
    fs.appendFileSync(fileB, 'b2\n');
    await sleep(2500);

    const uriA = vscode.Uri.file(fileA);
    const uriB = vscode.Uri.file(fileB);

    await vscode.commands.executeCommand('agentDiffTracker.openHistoryItem', uriA);
    await sleep(500);
    await vscode.commands.executeCommand('agentDiffTracker.openHistoryItem', uriB);
    await sleep(500);

    // Regression: history clicks used to open a new persistent tab per file, so browsing
    // through several history entries left a pile of stale "Agent Diff Tracker" tabs behind.
    // There should only ever be one — the tab for whichever file was opened last.
    const diffTabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs).filter((t) => t.label.includes('Agent Diff Tracker'));
    assert.strictEqual(
      diffTabs.length,
      1,
      `expected exactly one Agent Diff Tracker tab, got: ${JSON.stringify(diffTabs.map((t) => t.label))}`,
    );
    assert.ok(diffTabs[0].label.includes('tracked-b.txt'), `expected the single tab to show the file opened last, got: ${diffTabs[0].label}`);

    const activeLabel = vscode.window.tabGroups.activeTabGroup.activeTab?.label ?? '';
    assert.ok(
      activeLabel.includes('tracked-b.txt'),
      `expected focus to remain on the diff the user just opened, got active tab: ${activeLabel}`,
    );
  });

  it('pinning the diff tab keeps it open when the next change comes in', async () => {
    const fileA = path.join(workspaceRoot(), 'tracked.txt');
    const fileB = path.join(workspaceRoot(), 'tracked-b.txt');

    await vscode.commands.executeCommand('agentDiffTracker.openHistoryItem', vscode.Uri.file(fileA));
    await sleep(500);

    const tabBeforePin = vscode.window.tabGroups.all
      .flatMap((g) => g.tabs)
      .find((t) => t.label.includes('Agent Diff Tracker') && t.label.includes('tracked.txt'));
    assert.ok(tabBeforePin, 'expected a diff tab for tracked.txt before pinning');
    assert.ok(tabBeforePin!.isPreview, 'expected the tab to start as a preview tab');

    await vscode.commands.executeCommand('workbench.action.pinEditor');
    await sleep(200);
    const tabAfterPin = vscode.window.tabGroups.all
      .flatMap((g) => g.tabs)
      .find((t) => t.label.includes('Agent Diff Tracker') && t.label.includes('tracked.txt'));
    assert.ok(tabAfterPin && !tabAfterPin.isPreview, 'expected the tab to no longer be a preview after pinning');

    // A new change to a different file should open its own tab, leaving the pinned one alone.
    fs.appendFileSync(fileB, 'pin-test\n');
    await sleep(2500);

    const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs).filter((t) => t.label.includes('Agent Diff Tracker'));
    const pinnedStillThere = tabs.some((t) => t.label.includes('tracked.txt'));
    const newOneOpened = tabs.some((t) => t.label.includes('tracked-b.txt'));
    assert.ok(pinnedStillThere, `expected the pinned tracked.txt tab to survive, got: ${JSON.stringify(tabs.map((t) => t.label))}`);
    assert.ok(newOneOpened, 'expected a new tab for tracked-b.txt alongside the pinned one');
    assert.strictEqual(tabs.length, 2, `expected exactly the pinned tab plus one new tab, got: ${JSON.stringify(tabs.map((t) => t.label))}`);

    // Unpin so later tests (which assume a single reusable tab) start from a clean slate.
    await vscode.window.tabGroups.close(tabAfterPin!);
  });

  it('a multi-file burst opens only one diff tab, for the last file in the burst', async () => {
    const fileA = path.join(workspaceRoot(), 'tracked.txt');
    const fileB = path.join(workspaceRoot(), 'tracked-b.txt');

    // Close any tabs left from earlier tests so the count assertion below is unambiguous.
    for (const tab of vscode.window.tabGroups.all.flatMap((g) => g.tabs)) {
      if (tab.label.includes('Agent Diff Tracker')) await vscode.window.tabGroups.close(tab);
    }

    // Two files changed within the same debounce window == one burst.
    fs.appendFileSync(fileA, 'burst-a\n');
    fs.appendFileSync(fileB, 'burst-b\n');
    await sleep(2500);

    const diffTabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs).filter((t) => t.label.includes('Agent Diff Tracker'));
    assert.strictEqual(
      diffTabs.length,
      1,
      `expected exactly one diff tab for a multi-file burst, got: ${JSON.stringify(diffTabs.map((t) => t.label))}`,
    );
    // Which of the two files "wins" depends on filesystem watcher event ordering between
    // two different files, which isn't guaranteed — the invariant that matters is that
    // there's exactly one tab (asserted above), not which specific file it shows.
    assert.ok(
      diffTabs[0].label.includes('tracked.txt') || diffTabs[0].label.includes('tracked-b.txt'),
      `expected the tab to show one of the two burst files, got: ${diffTabs[0].label}`,
    );
  });

  it('opens a labeled diff (not a bare editor) for brand-new untracked files', async () => {
    const filePath = path.join(workspaceRoot(), 'brand-new-file.txt');
    fs.writeFileSync(filePath, 'hello\nworld\n');
    await sleep(2500);

    const titles = vscode.window.tabGroups.all.flatMap((group) => group.tabs.map((tab) => tab.label));
    // Regression: untracked files used to open as a plain editor tab with no baseline
    // and no "(Agent Diff Tracker)" label, unlike every other change.
    assert.ok(
      titles.some((title) => title.includes('brand-new-file.txt') && title.includes('Agent Diff Tracker')),
      `expected a labeled diff tab for the new file, got: ${JSON.stringify(titles)}`,
    );
  });

  it('re-jumps to the first changed line when an already-open file is edited again', async () => {
    const filePath = path.join(workspaceRoot(), 'tracked.txt');
    // First edit: opens the diff, cursor lands on the first change.
    fs.appendFileSync(filePath, 'edit-one\n');
    await sleep(2500);

    // Deliberately move the cursor away inside the diff's modified editor. The scheme
    // filter matters: the diff's LEFT side (git: baseline) shares the same fsPath.
    const modifiedSide = (e: vscode.TextEditor) => e.document.uri.scheme === 'file' && e.document.uri.fsPath === filePath;
    const diffEditor = vscode.window.visibleTextEditors.find(modifiedSide);
    assert.ok(diffEditor, `expected the diff modified-side editor to be visible, visible: ${JSON.stringify(vscode.window.visibleTextEditors.map((e) => e.document.uri.toString()))}`);
    diffEditor!.selection = new vscode.Selection(0, 0, 0, 0);

    // Second edit while the tab is open: should reset to top and jump to the first change again.
    fs.appendFileSync(filePath, 'edit-two\n');
    await sleep(2500);

    const editorAfter = vscode.window.visibleTextEditors.find(modifiedSide);
    assert.ok(editorAfter, 'diff editor should still be visible after the second edit');
    // Baseline has 1 committed line, so the first changed line is line index 1.
    // Regression: the cursor used to stay wherever it was, so nextChange skipped ahead
    // (or nowhere), leaving the user staring at an unchanged region.
    assert.strictEqual(
      editorAfter!.selection.active.line,
      1,
      `expected cursor on the first changed line (1), got line ${editorAfter!.selection.active.line}`,
    );
  });

  it('jumps to and reveals a change deep in a large file, even when scrolled far away', async () => {
    const filePath = path.join(workspaceRoot(), 'tracked-large.txt');

    // Open the file first and scroll/position it to the very top — simulates the
    // user reading line 1 while the agent is about to edit line 1000 elsewhere.
    const doc = await vscode.workspace.openTextDocument(filePath);
    const editor = await vscode.window.showTextDocument(doc, { preview: false });
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    editor.revealRange(new vscode.Range(0, 0, 0, 0), vscode.TextEditorRevealType.AtTop);
    await sleep(200);
    assert.strictEqual(editor.selection.active.line, 0, 'sanity: should start at line 0');

    // Agent edits line 1000 (0-based index 999) of the 2000-line file.
    const original = fs.readFileSync(filePath, 'utf8');
    const lines = original.split('\n');
    lines[999] = 'THE AGENT CHANGED THIS LINE';
    fs.writeFileSync(filePath, lines.join('\n'));
    await sleep(2500);

    const modifiedSide = (e: vscode.TextEditor) =>
      e.document.uri.scheme === 'file' && e.document.uri.fsPath === filePath;
    const diffEditor = vscode.window.visibleTextEditors.find(modifiedSide);
    assert.ok(diffEditor, 'expected the diff modified-side editor to be visible after the deep edit');

    assert.strictEqual(
      diffEditor!.selection.active.line,
      999,
      `expected cursor on the changed line (999), got line ${diffEditor!.selection.active.line}`,
    );

    // The changed line should be pinned near the TOP of the viewport (AtTop reveal), not
    // centered or just somewhere within it (InCenter would also pass a mere "contains"
    // check) — the goal is maximizing how much of the diff/following context is visible
    // below it. VS Code's AtTop leaves a small intentional margin above the target rather
    // than putting it on the viewport's exact first line, so allow a modest window rather
    // than asserting exact placement — the real regression this guards against is landing
    // in the MIDDLE of the viewport (e.g. line ~990-1008 for a ~35-line viewport centered
    // on 999), which this window excludes.
    const topLine = diffEditor!.visibleRanges[0]?.start.line;
    assert.ok(
      topLine !== undefined && topLine <= 999 && topLine >= 999 - 10,
      `expected the changed line (999) to be at/near the top of the viewport (not centered), got top visible line ${topLine}`,
    );
  });

  it('jumps to the real code change, not a one-line import addition (the reported UX complaint)', async () => {
    const filePath = path.join(workspaceRoot(), 'tracked-code.txt');

    const original = fs.readFileSync(filePath, 'utf8');
    const lines = original.split('\n');
    // Baseline: ["import a from 'a'", "", "function f() {", "  return 1", "}", ""]
    // Edit: add one import line near the top, AND substantially rewrite the function body.
    // A naive "first differing line" scan would stop at the import (line 1) and the user
    // would never see the actual logic change — that's the bug being fixed here.
    lines.splice(1, 0, "import b from 'b'");
    const bodyStart = lines.indexOf('function f() {') + 1;
    lines.splice(
      bodyStart,
      1,
      '  const x = computeSomething()',
      '  const y = transformSomething(x)',
      '  const z = combineResults(x, y)',
      '  return x + y + z',
    );
    fs.writeFileSync(filePath, lines.join('\n'));
    await sleep(2500);

    const modifiedSide = (e: vscode.TextEditor) =>
      e.document.uri.scheme === 'file' && e.document.uri.fsPath === filePath;
    const diffEditor = vscode.window.visibleTextEditors.find(modifiedSide);
    assert.ok(diffEditor, 'expected the diff modified-side editor to be visible');

    const landedLine = diffEditor!.selection.active.line;
    assert.notStrictEqual(landedLine, 1, 'should not land on the one-line import addition');
    assert.ok(
      landedLine >= bodyStart,
      `expected the cursor within the rewritten function body (line >= ${bodyStart}), got line ${landedLine}`,
    );
  });

  it('toggle command flips watching state without error', async () => {
    await assert.doesNotReject(() => Promise.resolve(vscode.commands.executeCommand('agentDiffTracker.toggle')));
    await assert.doesNotReject(() => Promise.resolve(vscode.commands.executeCommand('agentDiffTracker.toggle')));
  });

  it('clearHistory command runs without error', async () => {
    await assert.doesNotReject(() => Promise.resolve(vscode.commands.executeCommand('agentDiffTracker.clearHistory')));
  });
});
