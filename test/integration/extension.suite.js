"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const workspaceRoot = () => vscode.workspace.workspaceFolders?.[0].uri.fsPath;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
describe('Agent Diff Tracker (integration)', function () {
    this.timeout(30000);
    let extension;
    before(async () => {
        extension = vscode.extensions.getExtension('JoaquinTelleria.agent-diff-tracker');
        assert.ok(extension, 'extension should be discoverable by id');
        await extension.activate();
        // Give the vscode.git extension a moment to index the fixture repo.
        await sleep(2000);
    });
    it('activates without throwing', () => {
        assert.strictEqual(extension.isActive, true);
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
        assert.ok(titles.some((title) => title.includes('Agent Diff Tracker')), `expected a tab titled with "Agent Diff Tracker", got: ${JSON.stringify(titles)}`);
    });
    it('does not open a diff tab for excluded files (e.g. inside node_modules)', async () => {
        const dir = path.join(workspaceRoot(), 'node_modules', 'somepkg');
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, 'index.js');
        const tabCountBefore = vscode.window.tabGroups.all.flatMap((g) => g.tabs).length;
        fs.writeFileSync(filePath, 'module.exports = {};\n');
        await sleep(2500);
        const tabsAfter = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
        assert.ok(!tabsAfter.some((tab) => tab.label.includes('index.js')), 'excluded file should not have opened a diff/editor tab');
        // Sanity: we didn't just fail to observe any tabs at all.
        assert.ok(tabsAfter.length >= tabCountBefore);
    });
    it('toggle command flips watching state without error', async () => {
        await assert.doesNotReject(() => Promise.resolve(vscode.commands.executeCommand('agentDiffTracker.toggle')));
        await assert.doesNotReject(() => Promise.resolve(vscode.commands.executeCommand('agentDiffTracker.toggle')));
    });
    it('clearHistory command runs without error', async () => {
        await assert.doesNotReject(() => Promise.resolve(vscode.commands.executeCommand('agentDiffTracker.clearHistory')));
    });
});
//# sourceMappingURL=extension.suite.js.map