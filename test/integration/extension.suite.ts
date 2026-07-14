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

  it('openHistoryItem opens each file in its own persistent tab and leaves focus there', async () => {
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

    // Regression: history clicks used to reuse a single VS Code "preview" tab, so opening a
    // second history item silently replaced the first. Both files must now have their own
    // persistent (non-preview) diff tab. (VS Code may promote an existing preview tab for
    // the same diff rather than adding a new one, so tab COUNT is not a valid assertion.)
    const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
    const tabA = tabs.find((t) => t.label.includes('tracked.txt') && t.label.includes('Agent Diff Tracker'));
    const tabB = tabs.find((t) => t.label.includes('tracked-b.txt') && t.label.includes('Agent Diff Tracker'));
    assert.ok(tabA && !tabA.isPreview, `expected a persistent diff tab for tracked.txt, got: ${JSON.stringify(tabs.map((t) => ({ label: t.label, preview: t.isPreview })))}`);
    assert.ok(tabB && !tabB.isPreview, 'expected a persistent diff tab for tracked-b.txt');

    const activeLabel = vscode.window.tabGroups.activeTabGroup.activeTab?.label ?? '';
    assert.ok(
      activeLabel.includes('tracked-b.txt'),
      `expected focus to remain on the diff the user just opened, got active tab: ${activeLabel}`,
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

    // Cursor position alone isn't proof of a visible scroll — assert the viewport
    // actually contains the changed line, not just that the selection moved there
    // while still scrolled to the top.
    const revealed = diffEditor!.visibleRanges.some((range) => range.contains(new vscode.Position(999, 0)));
    assert.ok(
      revealed,
      `expected line 999 to be within the visible viewport, got ranges: ${JSON.stringify(diffEditor!.visibleRanges.map((r) => [r.start.line, r.end.line]))}`,
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
