import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  const repoRoot = path.resolve(__dirname, '../../../');
  const extensionDevelopmentPath = repoRoot;
  const extensionTestsPath = path.resolve(__dirname, './index');
  const workspacePath = path.resolve(repoRoot, 'test/integration/fixtures/workspace');

  try {
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspacePath, '--disable-extensions'],
    });
  } catch (err) {
    console.error('Failed to run integration tests', err);
    process.exit(1);
  }
}

void main();
