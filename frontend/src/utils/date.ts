const DAY_NAMES_RU = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const DAY_NAMES_SHORT_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_NAMES_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  const date = parseISODate(iso);
  const day = date.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toISODate(date);
}

export function dayNameRu(iso: string): string {
  const day = parseISODate(iso).getDay();
  return DAY_NAMES_RU[day === 0 ? 6 : day - 1];
}

export function dayShortRu(iso: string): string {
  const day = parseISODate(iso).getDay();
  return DAY_NAMES_SHORT_RU[day === 0 ? 6 : day - 1];
}

export function formatDayMonth(iso: string): string {
  const date = parseISODate(iso);
  return `${date.getDate()} ${MONTH_NAMES_RU[date.getMonth()].toLowerCase()}`;
}

export function monthLabelRu(iso: string): string {
  const date = parseISODate(iso);
  return `${MONTH_NAMES_RU[date.getMonth()]} ${date.getFullYear()}`;
}

export function shiftMonth(iso: string, delta: number): string {
  const date = parseISODate(iso);
  date.setMonth(date.getMonth() + delta);
  return toISODate(date);
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** True if `iso` is today and the current time falls within [start, end) — used to highlight the lesson happening right now. */
export function isHappeningNow(iso: string, start: string, end: string): boolean {
  if (!start || !end || iso !== todayISO()) return false;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  return nowMinutes >= startH * 60 + startM && nowMinutes < endH * 60 + endM;
}

export function isSameMonth(iso: string, anchorIso: string): boolean {
  const a = parseISODate(iso);
  const b = parseISODate(anchorIso);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export type WeekParity = "ch" | "zn";

/**
 * Which week ("ch" = числитель, "zn" = знаменатель) `iso` falls in, given the
 * semester's week-1 Monday and that week's parity. Mirrors
 * backend/src/services/weekParity.ts's resolveWeekParity — used here only to
 * label the two-week view, the schedule data itself is already resolved
 * server-side.
 */
export function resolveWeekParity(iso: string, semesterStart: string, startParity: WeekParity): WeekParity {
  const dateMonday = parseISODate(startOfWeek(iso));
  const startMonday = parseISODate(startOfWeek(semesterStart));
  const days = Math.round((dateMonday.getTime() - startMonday.getTime()) / 86_400_000);
  const weeksOffset = Math.round(days / 7);
  const other: WeekParity = startParity === "ch" ? "zn" : "ch";
  return weeksOffset % 2 === 0 ? startParity : other;
}

/** 42 consecutive ISO dates (6 Mon-Sun weeks) covering the month `anchorIso` falls in. */
export function monthGridDates(anchorIso: string): string[] {
  const firstOfMonth = new Date(parseISODate(anchorIso).getFullYear(), parseISODate(anchorIso).getMonth(), 1);
  const gridStart = startOfWeek(toISODate(firstOfMonth));
  const dates: string[] = [];
  let cursor = gridStart;
  for (let i = 0; i < 42; i++) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}
