import type { ScheduleOccurrence } from "../../types/schedule";
import { dayNameRu, formatDayMonth } from "../../utils/date";
import { LessonCard } from "../LessonCard";

interface Props {
  date: string;
  occurrences: ScheduleOccurrence[];
  isToday: boolean;
  /** Hide the built-in day-name/date header — used by DayView, where the page's top toolbar already shows the date. */
  showHeader?: boolean;
}

export function DayColumn({ date, occurrences, isToday, showHeader = true }: Props) {
  const classes = ["day-column"];
  if (isToday) classes.push("day-column--today");

  return (
    <div className={classes.join(" ")}>
      {showHeader && (
        <div className="day-column__header">
          <span className="day-column__name">{dayNameRu(date)}</span>
          <span className="day-column__date">{formatDayMonth(date)}</span>
        </div>
      )}
      <div className="day-column__body">
        {occurrences.length === 0 ? (
          <div className="day-column__empty">Нет пар</div>
        ) : (
          occurrences.map((occ) => <LessonCard key={`${occ.lessonTemplateId}-${occ.date}`} occurrence={occ} />)
        )}
      </div>
    </div>
  );
}
