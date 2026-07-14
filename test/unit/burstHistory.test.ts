import * as assert from 'assert';
import { BurstStore, burstLabel } from '../../src/burstHistory';

const identityKey = (s: string) => s;

describe('BurstStore', () => {
  it('lists bursts newest first', () => {
    const store = new BurstStore<string>(identityKey);
    store.add(['a.ts'], 1000, 50);
    store.add(['b.ts', 'c.ts'], 2000, 50);
    const bursts = store.list();
    assert.strictEqual(bursts.length, 2);
    assert.strictEqual(bursts[0].timestamp, 2000);
    assert.deepStrictEqual([...bursts[0].items], ['b.ts', 'c.ts']);
    assert.strictEqual(bursts[1].timestamp, 1000);
  });

  it('merges a burst into the previous entry when it touches the exact same fileset', () => {
    const store = new BurstStore<string>(identityKey);
    store.add(['a.ts'], 1000, 50);
    store.add(['a.ts'], 2000, 50);
    store.add(['a.ts'], 3000, 50);
    const bursts = store.list();
    assert.strictEqual(bursts.length, 1, 'repeated edits to the same file should collapse into one entry');
    assert.strictEqual(bursts[0].repeatCount, 3);
    assert.strictEqual(bursts[0].timestamp, 3000, 'merged entry should show the most recent timestamp');
    assert.deepStrictEqual([...bursts[0].items], ['a.ts']);
  });

  it('does not merge across an interleaved different burst', () => {
    const store = new BurstStore<string>(identityKey);
    store.add(['a.ts'], 1000, 50);
    store.add(['b.ts'], 2000, 50);
    store.add(['a.ts'], 3000, 50);
    // a.ts appears twice, but not consecutively — three distinct entries, no merging.
    assert.strictEqual(store.list().length, 3);
  });

  it('merges multi-file bursts when the fileset matches regardless of order', () => {
    const store = new BurstStore<string>(identityKey);
    store.add(['a.ts', 'b.ts'], 1000, 50);
    store.add(['b.ts', 'a.ts'], 2000, 50);
    const bursts = store.list();
    assert.strictEqual(bursts.length, 1);
    assert.strictEqual(bursts[0].repeatCount, 2);
  });

  it('does not merge when the fileset differs even by one file', () => {
    const store = new BurstStore<string>(identityKey);
    store.add(['a.ts', 'b.ts'], 1000, 50);
    store.add(['a.ts'], 2000, 50);
    assert.strictEqual(store.list().length, 2);
  });

  it('new (unmerged) bursts start with repeatCount 1', () => {
    const store = new BurstStore<string>(identityKey);
    store.add(['a.ts'], 1000, 50);
    assert.strictEqual(store.list()[0].repeatCount, 1);
  });

  it('drops the oldest bursts beyond the cap', () => {
    const store = new BurstStore<string>(identityKey);
    for (let i = 0; i < 10; i++) store.add([`f${i}.ts`], i, 3);
    const bursts = store.list();
    assert.strictEqual(bursts.length, 3);
    assert.deepStrictEqual([...bursts[0].items], ['f9.ts']);
    assert.deepStrictEqual([...bursts[2].items], ['f7.ts']);
  });

  it('ignores empty bursts', () => {
    const store = new BurstStore<string>(identityKey);
    store.add([], 1000, 50);
    assert.strictEqual(store.list().length, 0);
  });

  it('clamps nonsense caps to keep at least one burst', () => {
    const store = new BurstStore<string>(identityKey);
    store.add(['a.ts'], 1000, 0);
    assert.strictEqual(store.list().length, 1);
    store.add(['b.ts'], 2000, NaN);
    assert.strictEqual(store.list().length, 1);
    assert.deepStrictEqual([...store.list()[0].items], ['b.ts']);
  });

  it('copies the items array so later mutation of the input cannot rewrite history', () => {
    const store = new BurstStore<string>(identityKey);
    const input = ['a.ts'];
    store.add(input, 1000, 50);
    input.push('sneaky.ts');
    assert.deepStrictEqual([...store.list()[0].items], ['a.ts']);
  });

  it('clear empties the store', () => {
    const store = new BurstStore<string>(identityKey);
    store.add(['a.ts'], 1000, 50);
    store.clear();
    assert.strictEqual(store.list().length, 0);
  });
});

describe('burstLabel', () => {
  it('pluralizes correctly with no repeats', () => {
    assert.strictEqual(burstLabel(1, 1), '1 file');
    assert.strictEqual(burstLabel(2, 1), '2 files');
  });

  it('appends a repeat marker when repeatCount > 1', () => {
    assert.strictEqual(burstLabel(2, 3), '2 files · ×3');
  });
});
