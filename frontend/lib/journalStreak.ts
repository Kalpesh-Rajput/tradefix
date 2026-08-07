/** Consecutive mood check-in days ending today or yesterday. */
export function consecutiveJournalStreak(
  dates: string[],
  todayKey: string
): number {
  if (!dates.length) return 0;
  const set = new Set(dates.map((d) => d.slice(0, 10)));

  const parse = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const keyOf = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const today = parse(todayKey);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  let cursor = set.has(todayKey) ? today : yesterday;
  if (!set.has(keyOf(cursor))) return 0;

  let streak = 0;
  while (set.has(keyOf(cursor))) {
    streak += 1;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
