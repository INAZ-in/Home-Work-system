import type { ScheduleOccurrence } from "../types/schedule";
import { todayISO } from "../utils/date";
import { DayColumn } from "./WeekView/DayColumn";

interface Props {
  date: string;
  occurrences: ScheduleOccurrence[];
  isLoading: boolean;
}

/** Single-day agenda — the default view on phones (see SchedulePage), navigated with the same prev/next/today controls as the other views, just stepping one day at a time. */
export function DayView({ date, occurrences, isLoading }: Props) {
  return (
    <div className="day-view">
      {isLoading && <div className="loading-banner">Загрузка расписания…</div>}
      <DayColumn date={date} occurrences={occurrences} isToday={date === todayISO()} showHeader={false} />
    </div>
  );
}
