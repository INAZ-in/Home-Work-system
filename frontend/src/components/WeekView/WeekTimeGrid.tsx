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

// A lesson within this many minutes of its pair's nominal (backend `pairs`
// table) time still shares that pair's row — e.g. "Введение в
// специальность" really starting at 12:25 instead of pair 3's nominal
// 12:15 (a short walk-time offset) still lines up with everyone else's
// pair 3. Only a genuinely different time (like ФКиС's off-campus "09:25",
// closer to the *previous* pair's slot than its own nominal 10:10) breaks
// out into its own row. Judged against `occ.nominalPair` (a stable,
// backend-sourced value shared by every occurrence of that pair number —
// see scheduleResolver.ts) rather than anything derived from this week's
// occurrences, so a couple of overridden lessons this week can't drag the
// row's anchor away from the pair's real usual time.
const ROW_MERGE_TOLERANCE_MINUTES = 30;

/** Which row an occurrence belongs to, and that row's displayed time — its pair's nominal time when close enough to share that row, otherwise its own real time in a row of its own. */
function slotFor(occ: ScheduleOccurrence): { key: string; time: TimeSlot } {
  const nominal = occ.nominalPair;
  if (nominal.start && Math.abs(toMinutes(occ.pair.start) - toMinutes(nominal.start)) <= ROW_MERGE_TOLERANCE_MINUTES) {
    return { key: `pair:${occ.pair.num}`, time: nominal };
  }
  return { key: `time:${occ.pair.start}`, time: { start: occ.pair.start, end: occ.pair.end } };
}

/** One row per distinct slot across every visible day, sorted chronologically — so e.g. a 10:10 lesson lines up with every other day's 10:10 lesson instead of whichever card happened to come first in that day's list. */
function buildSlots(occByDate: Map<string, ScheduleOccurrence[]>): { key: string; time: TimeSlot }[] {
  const byKey = new Map<string, TimeSlot>();
  for (const occs of occByDate.values()) {
    for (const occ of occs) {
      const { key, time } = slotFor(occ);
      if (!byKey.has(key)) byKey.set(key, time);
    }
  }
  return [...byKey.entries()]
    .map(([key, time]) => ({ key, time }))
    .sort((a, b) => a.time.start.localeCompare(b.time.start));
}

function groupBySlot(occs: ScheduleOccurrence[]): Map<string, ScheduleOccurrence[]> {
  const byKey = new Map<string, ScheduleOccurrence[]>();
  for (const occ of occs) {
    const { key } = slotFor(occ);
    const list = byKey.get(key) ?? [];
    list.push(occ);
    byKey.set(key, list);
  }
  return byKey;
}

/** Side-by-side day columns sharing one vertical time axis, so cells sit at the row their actual pair time maps to instead of the row their index in that day's list happens to land on. */
export function WeekTimeGrid({ days, occByDate, plansByDate, today }: Props) {
  const slots = buildSlots(occByDate);
  const hasPlans = days.some((date) => (plansByDate.get(date) ?? []).length > 0);
  const occByDateAndSlot = new Map(days.map((date) => [date, groupBySlot(occByDate.get(date) ?? [])]));

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
