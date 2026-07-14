const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Buckets a timestamp into a calendar-relative label for grouping history entries. */
const bucketLabel = (timestamp: number, now: number): 'Today' | 'Yesterday' | 'Earlier' => {
  const dayDiff = Math.round((startOfDay(now) - startOfDay(timestamp)) / 86_400_000);
  if (dayDiff <= 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  return 'Earlier';
};

const BUCKET_ORDER = ['Today', 'Yesterday', 'Earlier'] as const;

export { bucketLabel, BUCKET_ORDER };
