import * as assert from 'assert';
import { globToRegex, shouldIgnorePath } from '../../src/matching';

describe('globToRegex', () => {
  it('matches a leading **/ as any depth including root', () => {
    const re = globToRegex('**/node_modules/**');
    assert.ok(re.test('node_modules/foo/index.js'));
    assert.ok(re.test('packages/app/node_modules/foo/index.js'));
    assert.ok(!re.test('src/node_modules_backup/index.js'));
  });

  it('matches * as a single path segment, not across slashes', () => {
    const re = globToRegex('*.log');
    assert.ok(re.test('debug.log'));
    assert.ok(!re.test('logs/debug.log'));
  });

  it('matches literal dots exactly, not as wildcard', () => {
    const re = globToRegex('*.tsbuildinfo');
    assert.ok(re.test('tsconfig.tsbuildinfo'));
    assert.ok(!re.test('tsconfigXtsbuildinfo'));
  });

  it('matches ? as exactly one character', () => {
    const re = globToRegex('a?c.txt');
    assert.ok(re.test('abc.txt'));
    assert.ok(!re.test('ac.txt'));
    assert.ok(!re.test('abbc.txt'));
  });

  it('handles a mid-pattern * combined with a literal prefix (cmake-build-*)', () => {
    const re = globToRegex('**/cmake-build-*/**');
    assert.ok(re.test('cmake-build-debug/CMakeCache.txt'));
    assert.ok(re.test('native/cmake-build-release/obj/a.o'));
    assert.ok(!re.test('cmake-buildish/file.txt'));
  });

  it('is immune to literal text resembling internal tokens (regression)', () => {
    // The old implementation replaced marker strings like " STAR " / " DS " and
    // corrupted patterns whose literal text contained them.
    assert.ok(globToRegex('**/STAR/**').test('a/STAR/b.txt'));
    assert.ok(globToRegex('a STAR b/*.txt').test('a STAR b/x.txt'));
    assert.ok(!globToRegex('a STAR b/*.txt').test('a-anything-b/x.txt'));
    assert.ok(globToRegex('x DS y/**').test('x DS y/deep/file.js'));
    assert.ok(globToRegex('** QM **').test('anything QM whatever'));
  });

  it('escapes regex metacharacters in literal pattern text', () => {
    const re = globToRegex('a+b(c)/[dir]/*.txt');
    assert.ok(re.test('a+b(c)/[dir]/x.txt'));
    assert.ok(!re.test('aab(c)/[dir]/x.txt'));
    assert.ok(!re.test('a+b(c)/d/x.txt'));
  });

  it('treats a trailing /** as the directory itself or anything inside it', () => {
    const re = globToRegex('coverage/**');
    assert.ok(re.test('coverage/lcov.info'));
    assert.ok(re.test('coverage/html/index.html'));
    assert.ok(!re.test('coverage-report/lcov.info'));
  });

  it('supports bare ** as match-anything', () => {
    const re = globToRegex('**');
    assert.ok(re.test('anything/at/all.txt'));
    assert.ok(re.test('root.txt'));
  });

  it('does not match partially — pattern must span the whole path', () => {
    const re = globToRegex('src/*.ts');
    assert.ok(re.test('src/extension.ts'));
    assert.ok(!re.test('packages/src/extension.ts'));
    assert.ok(!re.test('src/extension.ts.bak'));
  });
});

describe('shouldIgnorePath', () => {
  it('ignores hard-excluded directory segments regardless of user patterns', () => {
    assert.ok(shouldIgnorePath('node_modules/foo/index.js', []));
    assert.ok(shouldIgnorePath('.git/HEAD', []));
    assert.ok(shouldIgnorePath('packages/app/dist/bundle.js', []));
    assert.ok(shouldIgnorePath('__pycache__/mod.cpython-311.pyc', []));
    assert.ok(shouldIgnorePath('ios/Pods/Alamofire/readme.md', []));
  });

  it('matches hard-excluded segments exactly, not as substrings', () => {
    assert.ok(!shouldIgnorePath('distribution/index.ts', []));
    assert.ok(!shouldIgnorePath('src/output.ts', []));
    assert.ok(!shouldIgnorePath('builder/main.go', []));
  });

  it('is case-sensitive about hard-excluded segments (Pods vs pods)', () => {
    assert.ok(shouldIgnorePath('Pods/x.m', []));
    assert.ok(!shouldIgnorePath('pods/x.m', []));
  });

  it('ignores graphify-out and everything under it, at any depth, regardless of user patterns', () => {
    assert.ok(shouldIgnorePath('graphify-out/cache/stat-index.json', []));
    assert.ok(shouldIgnorePath('graphify-out/graph.json', []));
    assert.ok(shouldIgnorePath('packages/app/graphify-out/wiki/index.md', []));
  });

  it('ignores hard-excluded suffixes at any depth regardless of user patterns', () => {
    assert.ok(shouldIgnorePath('tsconfig.tsbuildinfo', []));
    assert.ok(shouldIgnorePath('server.log', []));
    assert.ok(shouldIgnorePath('deep/nested/dir/tsconfig.tsbuildinfo', []));
    assert.ok(shouldIgnorePath('a/b/c/app.pyc', []));
  });

  it('does not ignore ordinary source files by default', () => {
    assert.ok(!shouldIgnorePath('src/extension.ts', []));
    assert.ok(!shouldIgnorePath('README.md', []));
    assert.ok(!shouldIgnorePath('app/components/Button.tsx', []));
  });

  it('does not over-match suffixes as substrings (blog.ts is not a .log)', () => {
    assert.ok(!shouldIgnorePath('src/blog.ts', []));
    assert.ok(!shouldIgnorePath('catalog.tsx', []));
  });

  it('applies user-supplied exclude patterns', () => {
    assert.ok(shouldIgnorePath('secrets/api-key.txt', ['secrets/**']));
    assert.ok(!shouldIgnorePath('src/secrets.ts', ['secrets/**']));
  });

  it('an invalid-looking user pattern cannot disable the hard excludes', () => {
    assert.ok(shouldIgnorePath('node_modules/x.js', ['only-this/**']));
  });
});
