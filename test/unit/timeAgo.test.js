"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const timeAgo_1 = require("../../src/timeAgo");
describe('timeAgo', () => {
    const NOW = 1000000000;
    it('reports "just now" for sub-5-second deltas', () => {
        assert.strictEqual((0, timeAgo_1.timeAgo)(NOW - 4000, NOW), 'just now');
    });
    it('reports seconds for deltas under a minute', () => {
        assert.strictEqual((0, timeAgo_1.timeAgo)(NOW - 30000, NOW), '30s ago');
    });
    it('reports minutes for deltas under an hour', () => {
        assert.strictEqual((0, timeAgo_1.timeAgo)(NOW - 5 * 60000, NOW), '5m ago');
    });
    it('reports hours for deltas of an hour or more', () => {
        assert.strictEqual((0, timeAgo_1.timeAgo)(NOW - 3 * 3600000, NOW), '3h ago');
    });
    it('clamps negative deltas (future timestamps) to zero seconds', () => {
        assert.strictEqual((0, timeAgo_1.timeAgo)(NOW + 10000, NOW), 'just now');
    });
});
//# sourceMappingURL=timeAgo.test.js.map