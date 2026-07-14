import * as assert from 'assert';
import { bucketLabel } from '../../src/historyGrouping';

describe('bucketLabel', () => {
  const noonToday = new Date(2026, 0, 15, 12, 0, 0).getTime();

  it('buckets same-calendar-day timestamps as Today, even hours apart', () => {
    const earlyMorning = new Date(2026, 0, 15, 0, 30, 0).getTime();
    assert.strictEqual(bucketLabel(earlyMorning, noonToday), 'Today');
  });

  it('buckets the previous calendar day as Yesterday', () => {
    const lateLastNight = new Date(2026, 0, 14, 23, 59, 0).getTime();
    assert.strictEqual(bucketLabel(lateLastNight, noonToday), 'Yesterday');
  });

  it('buckets anything older than yesterday as Earlier', () => {
    const lastWeek = new Date(2026, 0, 8, 12, 0, 0).getTime();
    assert.strictEqual(bucketLabel(lastWeek, noonToday), 'Earlier');
  });

  it('treats a future timestamp (clock skew) as Today rather than throwing', () => {
    const future = new Date(2026, 0, 16, 12, 0, 0).getTime();
    assert.strictEqual(bucketLabel(future, noonToday), 'Today');
  });
});
