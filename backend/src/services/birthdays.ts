/**
 * Days from `todayIso` to the next occurrence of `birthDateIso`'s month/day
 * (0 if it's today, wraps to next year once this year's has already
 * passed). A Feb 29 birthday rolls to Mar 1 in a non-leap target year —
 * `Date.UTC`'s own overflow behavior, not special-cased here.
 */
export function daysUntilNextBirthday(birthDateIso: string, todayIso: string): number {
  const [, month, day] = birthDateIso.split("-").map(Number);
  const [year, todayMonth, todayDay] = todayIso.split("-").map(Number);
  const today = Date.UTC(year, todayMonth - 1, todayDay);

  let next = Date.UTC(year, month - 1, day);
  if (next < today) next = Date.UTC(year + 1, month - 1, day);

  return Math.round((next - today) / 86_400_000);
}
