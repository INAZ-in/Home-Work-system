import type { ScheduleOccurrence } from "../../types/schedule";
import { addDays, startOfWeek, todayISO } from "../../utils/date";
import { DayColumn } from "./DayColumn";

interface Props {
  anchorDate: string;
  occurrences: ScheduleOccurrence[];
  isLoading: boolean;
}

export function WeekView({ anchorDate, occurrences, isLoading }: Props) {
  const weekStart = startOfWeek(anchorDate);
  // Mon..Sat — this schedule never has Sunday lessons.
  const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));

  const byDate = new Map<string, ScheduleOccurrence[]>();
  for (const occ of occurrences) {
    const list = byDate.get(occ.date) ?? [];
    list.push(occ);
    byDate.set(occ.date, list);
  }

  const today = todayISO();

  return (
    <div className="week-view">
      {isLoading && <div className="loading-banner">Загрузка расписания…</div>}
      <div className="week-view__grid">
        {days.map((date) => (
          <DayColumn key={date} date={date} occurrences={byDate.get(date) ?? []} isToday={date === today} />
        ))}
      </div>
    </div>
  );
}
