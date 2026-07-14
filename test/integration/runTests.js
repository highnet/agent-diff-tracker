"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const test_electron_1 = require("@vscode/test-electron");
async function main() {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './index');
    const workspacePath = path.resolve(__dirname, './fixtures/workspace');
    try {
        await (0, test_electron_1.runTests)({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [workspacePath, '--disable-extensions'],
        });
    }
    catch (err) {
        console.error('Failed to run integration tests', err);
        process.exit(1);
    }
}
void main();
//# sourceMappingURL=runTests.js.map