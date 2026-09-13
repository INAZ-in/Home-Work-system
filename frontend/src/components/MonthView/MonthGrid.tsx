import { useState } from "react";
import type { ScheduleOccurrence } from "../../types/schedule";
import { isSameMonth, monthGridDates, todayISO } from "../../utils/date";
import { DayDetailModal } from "./DayDetailModal";
import { MonthDayCell } from "./MonthDayCell";

const WEEKDAY_HEADERS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

interface Props {
  anchorDate: string;
  occurrences: ScheduleOccurrence[];
  isLoading: boolean;
}

export function MonthGrid({ anchorDate, occurrences, isLoading }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const dates = monthGridDates(anchorDate);
  const today = todayISO();

  const byDate = new Map<string, ScheduleOccurrence[]>();
  for (const occ of occurrences) {
    const list = byDate.get(occ.date) ?? [];
    list.push(occ);
    byDate.set(occ.date, list);
  }

  return (
    <div className="month-view">
      {isLoading && <div className="loading-banner">Загрузка расписания…</div>}
      <div className="month-grid__headers">
        {WEEKDAY_HEADERS.map((h) => (
          <div key={h} className="month-grid__header">
            {h}
          </div>
        ))}
      </div>
      <div className="month-grid">
        {dates.map((date) => (
          <MonthDayCell
            key={date}
            date={date}
            occurrences={byDate.get(date) ?? []}
            inCurrentMonth={isSameMonth(date, anchorDate)}
            isToday={date === today}
            onSelect={() => setSelectedDate(date)}
          />
        ))}
      </div>
      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          occurrences={byDate.get(selectedDate) ?? []}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
