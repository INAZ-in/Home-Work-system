import { Fragment } from "react";
import type { PersonalPlan, ScheduleOccurrence } from "../../types/schedule";
import { dayNameRu, formatDayMonth } from "../../utils/date";
import { LessonCard } from "../LessonCard";
import { PersonalPlanCard } from "../PersonalPlanCard";

interface Props {
  days: string[];
  occByDate: Map<string, ScheduleOccurrence[]>;
  plansByDate: Map<string, PersonalPlan[]>;
  today: string;
}

interface TimeSlot {
  start: string;
  end: string;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// A lesson within this many minutes of its pair's usual time still shares
// that pair's row — e.g. "Введение в специальность" really starting at
// 12:25 instead of pair 3's usual 12:15 (a short walk-time offset) still
// lines up with everyone else's pair 3. Only a genuinely different time
// (like ФКиС's off-campus "09:25", closer to the *previous* pair's slot
// than its own nominal 10:10) breaks out into its own row — see
// canonicalTimesByPairNum below.
const ROW_MERGE_TOLERANCE_MINUTES = 30;

/** The most common {start,end} among every occurrence sharing a pair number, across the visible days — treated as that pair's "usual" row time. */
function canonicalTimesByPairNum(occByDate: Map<string, ScheduleOccurrence[]>): Map<number, TimeSlot> {
  const countsByPair = new Map<number, Map<string, number>>();
  for (const occs of occByDate.values()) {
    for (const occ of occs) {
      const counts = countsByPair.get(occ.pair.num) ?? new Map<string, number>();
      const key = `${occ.pair.start}|${occ.pair.end}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      countsByPair.set(occ.pair.num, counts);
    }
  }
  const result = new Map<number, TimeSlot>();
  for (const [pairNum, counts] of countsByPair) {
    let bestKey: string | null = null;
    let bestCount = 0;
    for (const [key, count] of counts) {
      if (count > bestCount) {
        bestKey = key;
        bestCount = count;
      }
    }
    if (bestKey) {
      const [start, end] = bestKey.split("|");
      result.set(pairNum, { start, end });
    }
  }
  return result;
}

/** Which row an occurrence belongs to, and that row's displayed time — its pair's canonical time when close enough to share that row, otherwise its own real time in a row of its own. */
function slotFor(occ: ScheduleOccurrence, canonical: Map<number, TimeSlot>): { key: string; time: TimeSlot } {
  const canon = canonical.get(occ.pair.num);
  if (canon && Math.abs(toMinutes(occ.pair.start) - toMinutes(canon.start)) <= ROW_MERGE_TOLERANCE_MINUTES) {
    return { key: `pair:${occ.pair.num}`, time: canon };
  }
  return { key: `time:${occ.pair.start}`, time: { start: occ.pair.start, end: occ.pair.end } };
}

/** One row per distinct slot across every visible day, sorted chronologically — so e.g. a 10:10 lesson lines up with every other day's 10:10 lesson instead of whichever card happened to come first in that day's list. */
function buildSlots(occByDate: Map<string, ScheduleOccurrence[]>, canonical: Map<number, TimeSlot>): { key: string; time: TimeSlot }[] {
  const byKey = new Map<string, TimeSlot>();
  for (const occs of occByDate.values()) {
    for (const occ of occs) {
      const { key, time } = slotFor(occ, canonical);
      if (!byKey.has(key)) byKey.set(key, time);
    }
  }
  return [...byKey.entries()]
    .map(([key, time]) => ({ key, time }))
    .sort((a, b) => a.time.start.localeCompare(b.time.start));
}

function groupBySlot(occs: ScheduleOccurrence[], canonical: Map<number, TimeSlot>): Map<string, ScheduleOccurrence[]> {
  const byKey = new Map<string, ScheduleOccurrence[]>();
  for (const occ of occs) {
    const { key } = slotFor(occ, canonical);
    const list = byKey.get(key) ?? [];
    list.push(occ);
    byKey.set(key, list);
  }
  return byKey;
}

/** Side-by-side day columns sharing one vertical time axis, so cells sit at the row their actual pair time maps to instead of the row their index in that day's list happens to land on. */
export function WeekTimeGrid({ days, occByDate, plansByDate, today }: Props) {
  const canonical = canonicalTimesByPairNum(occByDate);
  const slots = buildSlots(occByDate, canonical);
  const hasPlans = days.some((date) => (plansByDate.get(date) ?? []).length > 0);
  const occByDateAndSlot = new Map(days.map((date) => [date, groupBySlot(occByDate.get(date) ?? [], canonical)]));

  return (
    <div className="week-time-grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}>
      <div className="week-time-grid__corner" />
      {days.map((date) => (
        <div
          key={date}
          className={`week-time-grid__day-header${date === today ? " week-time-grid__day-header--today" : ""}`}
        >
          <span className="day-column__name">{dayNameRu(date)}</span>
          <span className="day-column__date">{formatDayMonth(date)}</span>
        </div>
      ))}

      {hasPlans && (
        <Fragment>
          <div className="week-time-grid__axis-label" />
          {days.map((date) => (
            <div key={date} className="week-time-grid__plans-cell">
              {(plansByDate.get(date) ?? []).map((plan) => (
                <PersonalPlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          ))}
        </Fragment>
      )}

      {slots.map((slot) => (
        <Fragment key={slot.key}>
          <div className="week-time-grid__axis-label">
            <span>{slot.time.start}</span>
            <span className="week-time-grid__axis-end">{slot.time.end}</span>
          </div>
          {days.map((date) => (
            <div key={date} className="week-time-grid__cell">
              {(occByDateAndSlot.get(date)?.get(slot.key) ?? []).map((occ) => (
                <LessonCard key={`${occ.lessonTemplateId}-${occ.date}`} occurrence={occ} />
              ))}
            </div>
          ))}
        </Fragment>
      ))}

      {slots.length === 0 && (
        <div className="week-time-grid__empty" style={{ gridColumn: `1 / span ${days.length + 1}` }}>
          Нет пар
        </div>
      )}
    </div>
  );
}
