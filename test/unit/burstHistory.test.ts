import * as assert from 'assert';
import { BurstStore, burstLabel } from '../../src/burstHistory';

describe('BurstStore', () => {
  it('lists bursts newest first', () => {
    const store = new BurstStore<string>();
    store.add(['a.ts'], 1000, 50);
    store.add(['b.ts', 'c.ts'], 2000, 50);
    const bursts = store.list();
    assert.strictEqual(bursts.length, 2);
    assert.strictEqual(bursts[0].timestamp, 2000);
    assert.deepStrictEqual([...bursts[0].items], ['b.ts', 'c.ts']);
    assert.strictEqual(bursts[1].timestamp, 1000);
  });

  it('keeps the same file in separate bursts — bursts are events, not a dedup index', () => {
    const store = new BurstStore<string>();
    store.add(['a.ts'], 1000, 50);
    store.add(['a.ts'], 2000, 50);
    assert.strictEqual(store.list().length, 2);
  });

  it('drops the oldest bursts beyond the cap', () => {
    const store = new BurstStore<string>();
    for (let i = 0; i < 10; i++) store.add([`f${i}.ts`], i, 3);
    const bursts = store.list();
    assert.strictEqual(bursts.length, 3);
    assert.deepStrictEqual([...bursts[0].items], ['f9.ts']);
    assert.deepStrictEqual([...bursts[2].items], ['f7.ts']);
  });

  it('ignores empty bursts', () => {
    const store = new BurstStore<string>();
    store.add([], 1000, 50);
    assert.strictEqual(store.list().length, 0);
  });

  it('clamps nonsense caps to keep at least one burst', () => {
    const store = new BurstStore<string>();
    store.add(['a.ts'], 1000, 0);
    assert.strictEqual(store.list().length, 1);
    store.add(['b.ts'], 2000, NaN);
    assert.strictEqual(store.list().length, 1);
    assert.deepStrictEqual([...store.list()[0].items], ['b.ts']);
  });

  it('copies the items array so later mutation of the input cannot rewrite history', () => {
    const store = new BurstStore<string>();
    const input = ['a.ts'];
    store.add(input, 1000, 50);
    input.push('sneaky.ts');
    assert.deepStrictEqual([...store.list()[0].items], ['a.ts']);
  });

  it('clear empties the store', () => {
    const store = new BurstStore<string>();
    store.add(['a.ts'], 1000, 50);
    store.clear();
    assert.strictEqual(store.list().length, 0);
  });
});

describe('burstLabel', () => {
  it('pluralizes correctly', () => {
    assert.strictEqual(burstLabel(1), '1 file');
    assert.strictEqual(burstLabel(2), '2 files');
  });
});
