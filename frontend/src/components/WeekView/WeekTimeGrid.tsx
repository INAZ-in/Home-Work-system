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
  num: number;
  start: string;
  end: string;
}

/** One row per distinct pair slot across every visible day, sorted by pair number (which already matches start-time order) — so e.g. a 10:10 lesson lines up with every other day's 10:10 slot instead of whichever card happened to come first in that day's list. */
function buildSlots(occByDate: Map<string, ScheduleOccurrence[]>): TimeSlot[] {
  const byNum = new Map<number, TimeSlot>();
  for (const occs of occByDate.values()) {
    for (const occ of occs) {
      if (!byNum.has(occ.pair.num)) {
        byNum.set(occ.pair.num, { num: occ.pair.num, start: occ.pair.start, end: occ.pair.end });
      }
    }
  }
  return [...byNum.values()].sort((a, b) => a.num - b.num);
}

function groupByPairNum(occs: ScheduleOccurrence[]): Map<number, ScheduleOccurrence[]> {
  const byNum = new Map<number, ScheduleOccurrence[]>();
  for (const occ of occs) {
    const list = byNum.get(occ.pair.num) ?? [];
    list.push(occ);
    byNum.set(occ.pair.num, list);
  }
  return byNum;
}

/** Side-by-side day columns sharing one vertical time axis, so cells sit at the row their actual pair time maps to instead of the row their index in that day's list happens to land on. */
export function WeekTimeGrid({ days, occByDate, plansByDate, today }: Props) {
  const slots = buildSlots(occByDate);
  const hasPlans = days.some((date) => (plansByDate.get(date) ?? []).length > 0);
  const occByDateAndSlot = new Map(days.map((date) => [date, groupByPairNum(occByDate.get(date) ?? [])]));

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
        <Fragment key={slot.num}>
          <div className="week-time-grid__axis-label">
            <span>{slot.start}</span>
            <span className="week-time-grid__axis-end">{slot.end}</span>
          </div>
          {days.map((date) => (
            <div key={date} className="week-time-grid__cell">
              {(occByDateAndSlot.get(date)?.get(slot.num) ?? []).map((occ) => (
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
