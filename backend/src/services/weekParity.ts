export type WeekParity = "ch" | "zn";

function otherParity(parity: WeekParity): WeekParity {
  return parity === "ch" ? "zn" : "ch";
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISODate(date);
}

/** Inclusive list of ISO dates from `fromIso` to `toIso`. */
export function dateRangeISO(fromIso: string, toIso: string): string[] {
  const dates: string[] = [];
  let cursor = fromIso;
  while (cursor <= toIso) {
    dates.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }
  return dates;
}

function mondayOfWeekUTC(date: Date): Date {
  const day = date.getUTCDay(); // 0 (Sun) .. 6 (Sat)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/** 1 (Monday) .. 7 (Sunday) — the schedule only ever uses 1..6. */
export function dayOfWeekMonday1(iso: string): number {
  const day = parseISODate(iso).getUTCDay();
  return day === 0 ? 7 : day;
}

export function isMonday(iso: string): boolean {
  return dayOfWeekMonday1(iso) === 1;
}

/**
 * Resolves which week ("ch" = числитель, "zn" = знаменатель) a calendar date
 * falls in, given the semester's start-of-week-1 date and which parity that
 * first week is. Parity alternates every 7 days from the semester start.
 */
export function resolveWeekParity(
  iso: string,
  semesterStartDateIso: string,
  startWeekParity: WeekParity,
): WeekParity {
  const dateMonday = mondayOfWeekUTC(parseISODate(iso));
  const startMonday = mondayOfWeekUTC(parseISODate(semesterStartDateIso));
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksOffset = Math.round((dateMonday.getTime() - startMonday.getTime()) / msPerWeek);
  return weeksOffset % 2 === 0 ? startWeekParity : otherParity(startWeekParity);
}
