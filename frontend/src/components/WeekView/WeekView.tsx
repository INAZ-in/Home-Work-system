import { useMediaQuery } from "../../hooks/useMediaQuery";
import type { PersonalPlan, ScheduleOccurrence } from "../../types/schedule";
import { addDays, startOfWeek, todayISO } from "../../utils/date";
import { DayColumn } from "./DayColumn";
import { WeekTimeGrid } from "./WeekTimeGrid";

/** "timeline" aligns every day's lessons to a shared clock-time axis (gaps included); "list" stacks each day's lessons top-aligned one after another with no gap rows. */
export type WeekLayout = "timeline" | "list";

interface Props {
  anchorDate: string;
  occurrences: ScheduleOccurrence[];
  plans?: PersonalPlan[];
  isLoading: boolean;
  layout?: WeekLayout;
}

// Matches the `max-width: 900px` breakpoint in .week-view__grid — below it
// days stack full-width one at a time, so there's no cross-day row to align
// and the shared time axis would just waste horizontal space.
const SIDE_BY_SIDE = "(min-width: 901px)";

function groupByDate<T extends { date: string }>(items: T[]): Map<string, T[]> {
  const byDate = new Map<string, T[]>();
  for (const item of items) {
    const list = byDate.get(item.date) ?? [];
    list.push(item);
    byDate.set(item.date, list);
  }
  return byDate;
}

export function WeekView({ anchorDate, occurrences, plans = [], isLoading, layout = "timeline" }: Props) {
  const weekStart = startOfWeek(anchorDate);
  // Mon..Sat — this schedule never has Sunday lessons.
  const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));

  const occByDate = groupByDate(occurrences);
  const plansByDate = groupByDate(plans);

  const today = todayISO();
  const sideBySide = useMediaQuery(SIDE_BY_SIDE);

  return (
    <div className="week-view">
      {isLoading && <div className="loading-banner">Загрузка расписания…</div>}
      {sideBySide && layout === "timeline" ? (
        <WeekTimeGrid days={days} occByDate={occByDate} plansByDate={plansByDate} today={today} />
      ) : (
        <div className="week-view__grid">
          {days.map((date) => (
            <DayColumn
              key={date}
              date={date}
              occurrences={occByDate.get(date) ?? []}
              plans={plansByDate.get(date) ?? []}
              isToday={date === today}
            />
          ))}
        </div>
      )}
    </div>
  );
}
