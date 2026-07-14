"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const matching_1 = require("../../src/matching");
describe('globToRegex', () => {
    it('matches a leading **/ as any depth including root', () => {
        const re = (0, matching_1.globToRegex)('**/node_modules/**');
        assert.ok(re.test('node_modules/foo/index.js'));
        assert.ok(re.test('packages/app/node_modules/foo/index.js'));
        assert.ok(!re.test('src/node_modules_backup/index.js'));
    });
    it('matches * as a single path segment, not across slashes', () => {
        const re = (0, matching_1.globToRegex)('*.log');
        assert.ok(re.test('debug.log'));
        assert.ok(!re.test('logs/debug.log'));
    });
    it('matches literal dots exactly, not as wildcard', () => {
        const re = (0, matching_1.globToRegex)('*.tsbuildinfo');
        assert.ok(re.test('tsconfig.tsbuildinfo'));
        assert.ok(!re.test('tsconfigXtsbuildinfo'));
    });
    it('matches ? as exactly one character', () => {
        const re = (0, matching_1.globToRegex)('a?c.txt');
        assert.ok(re.test('abc.txt'));
        assert.ok(!re.test('ac.txt'));
        assert.ok(!re.test('abbc.txt'));
    });
    it('does not let a mid-pattern combination collide with placeholder text', () => {
        // Regression: an earlier implementation used placeholder tokens that could
        // collide with pattern text containing the literal words (e.g. "STAR").
        const re = (0, matching_1.globToRegex)('**/STAR/**');
        assert.ok(re.test('a/STAR/b.txt'));
    });
});
describe('shouldIgnorePath', () => {
    it('ignores hard-excluded directory segments regardless of user patterns', () => {
        assert.ok((0, matching_1.shouldIgnorePath)('node_modules/foo/index.js', []));
        assert.ok((0, matching_1.shouldIgnorePath)('.git/HEAD', []));
        assert.ok((0, matching_1.shouldIgnorePath)('packages/app/dist/bundle.js', []));
    });
    it('ignores hard-excluded suffixes regardless of user patterns', () => {
        assert.ok((0, matching_1.shouldIgnorePath)('tsconfig.tsbuildinfo', []));
        assert.ok((0, matching_1.shouldIgnorePath)('server.log', []));
    });
    it('does not ignore ordinary source files by default', () => {
        assert.ok(!(0, matching_1.shouldIgnorePath)('src/extension.ts', []));
    });
    it('applies user-supplied exclude patterns', () => {
        assert.ok((0, matching_1.shouldIgnorePath)('secrets/api-key.txt', ['secrets/**']));
        assert.ok(!(0, matching_1.shouldIgnorePath)('src/secrets.ts', ['secrets/**']));
    });
});
//# sourceMappingURL=matching.test.js.map