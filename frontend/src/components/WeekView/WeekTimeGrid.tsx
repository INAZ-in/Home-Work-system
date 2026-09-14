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

// Rows key on the actual start time, not the pair number — a lesson whose
// real time was overridden (see migration 010, e.g. ФКиС's "09:25" parsed
// out of its subject text) has the same pair.num as everyone else's 10:10
// slot but must NOT share that slot's row, or it'd line up at the wrong
// clock time again — exactly what the shared axis exists to prevent.
function slotKey(occ: ScheduleOccurrence): string {
  return occ.pair.start;
}

/** One row per distinct start time across every visible day, sorted chronologically — so e.g. a 10:10 lesson lines up with every other day's 10:10 lesson instead of whichever card happened to come first in that day's list. */
function buildSlots(occByDate: Map<string, ScheduleOccurrence[]>): TimeSlot[] {
  const byStart = new Map<string, TimeSlot>();
  for (const occs of occByDate.values()) {
    for (const occ of occs) {
      if (!byStart.has(slotKey(occ))) {
        byStart.set(slotKey(occ), { start: occ.pair.start, end: occ.pair.end });
      }
    }
  }
  return [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start));
}

function groupByStart(occs: ScheduleOccurrence[]): Map<string, ScheduleOccurrence[]> {
  const byStart = new Map<string, ScheduleOccurrence[]>();
  for (const occ of occs) {
    const key = slotKey(occ);
    const list = byStart.get(key) ?? [];
    list.push(occ);
    byStart.set(key, list);
  }
  return byStart;
}

/** Side-by-side day columns sharing one vertical time axis, so cells sit at the row their actual pair time maps to instead of the row their index in that day's list happens to land on. */
export function WeekTimeGrid({ days, occByDate, plansByDate, today }: Props) {
  const slots = buildSlots(occByDate);
  const hasPlans = days.some((date) => (plansByDate.get(date) ?? []).length > 0);
  const occByDateAndSlot = new Map(days.map((date) => [date, groupByStart(occByDate.get(date) ?? [])]));

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
        <Fragment key={slot.start}>
          <div className="week-time-grid__axis-label">
            <span>{slot.start}</span>
            <span className="week-time-grid__axis-end">{slot.end}</span>
          </div>
          {days.map((date) => (
            <div key={date} className="week-time-grid__cell">
              {(occByDateAndSlot.get(date)?.get(slot.start) ?? []).map((occ) => (
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
