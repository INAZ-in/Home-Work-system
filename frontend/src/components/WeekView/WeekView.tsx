import type { PersonalPlan, ScheduleOccurrence } from "../../types/schedule";
import { addDays, startOfWeek, todayISO } from "../../utils/date";
import { DayColumn } from "./DayColumn";

interface Props {
  anchorDate: string;
  occurrences: ScheduleOccurrence[];
  plans?: PersonalPlan[];
  isLoading: boolean;
}

function groupByDate<T extends { date: string }>(items: T[]): Map<string, T[]> {
  const byDate = new Map<string, T[]>();
  for (const item of items) {
    const list = byDate.get(item.date) ?? [];
    list.push(item);
    byDate.set(item.date, list);
  }
  return byDate;
}

export function WeekView({ anchorDate, occurrences, plans = [], isLoading }: Props) {
  const weekStart = startOfWeek(anchorDate);
  // Mon..Sat — this schedule never has Sunday lessons.
  const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));

  const occByDate = groupByDate(occurrences);
  const plansByDate = groupByDate(plans);

  const today = todayISO();

  return (
    <div className="week-view">
      {isLoading && <div className="loading-banner">Загрузка расписания…</div>}
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
    </div>
  );
}
