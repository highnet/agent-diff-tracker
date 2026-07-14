import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { runTests } from '@vscode/test-electron';

/**
 * Builds the fixture workspace from scratch on every run: a tiny git repo with two
 * committed files. Generated rather than committed to this repo — an embedded .git
 * directory can't be tracked by the outer repository, and regenerating also wipes
 * any pollution from previous test runs.
 */
const createFixtureWorkspace = (workspacePath: string): void => {
  fs.rmSync(workspacePath, { recursive: true, force: true });
  fs.mkdirSync(workspacePath, { recursive: true });
  fs.writeFileSync(path.join(workspacePath, 'tracked.txt'), 'line1\n');
  fs.writeFileSync(path.join(workspacePath, 'tracked-b.txt'), 'b0\n');
  const git = (args: string) => execSync(`git ${args}`, { cwd: workspacePath, stdio: 'pipe' });
  git('init -q -b main');
  git('config user.email test@example.com');
  git('config user.name "Fixture"');
  git('add .');
  git('commit -q -m "fixture baseline"');
};

async function main() {
  const repoRoot = path.resolve(__dirname, '../../../');
  const extensionDevelopmentPath = repoRoot;
  const extensionTestsPath = path.resolve(__dirname, './index');
  const workspacePath = path.resolve(repoRoot, 'test/integration/fixtures/workspace');

  createFixtureWorkspace(workspacePath);

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
