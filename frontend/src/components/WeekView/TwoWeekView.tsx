import { useActiveSemester } from "../../hooks/useActiveSemester";
import type { PersonalPlan, ScheduleOccurrence } from "../../types/schedule";
import { addDays, formatDayMonth, resolveWeekParity, startOfWeek } from "../../utils/date";
import { WeekView } from "./WeekView";

interface Props {
  anchorDate: string;
  occurrences: ScheduleOccurrence[];
  plans?: PersonalPlan[];
  isLoading: boolean;
}

const PARITY_LABEL: Record<"ch" | "zn", string> = { ch: "числитель", zn: "знаменатель" };

export function TwoWeekView({ anchorDate, occurrences, plans = [], isLoading }: Props) {
  const { data: semester } = useActiveSemester();
  const week1Start = startOfWeek(anchorDate);
  const week2Start = addDays(week1Start, 7);

  return (
    <div className="two-week-view">
      {isLoading && <div className="loading-banner">Загрузка расписания…</div>}
      {[week1Start, week2Start].map((weekStart) => {
        const parity = semester ? resolveWeekParity(weekStart, semester.startDate, semester.startWeekParity) : null;
        return (
          <div key={weekStart} className="two-week-view__block">
            <div className="two-week-view__header">
              <span className="two-week-view__range">
                {formatDayMonth(weekStart)} – {formatDayMonth(addDays(weekStart, 5))}
              </span>
              {parity && (
                <span className={`week-parity-badge week-parity-badge--${parity}`}>{PARITY_LABEL[parity]}</span>
              )}
            </div>
            {/* Loading state is already shown once above, at the two-week level. */}
            <WeekView anchorDate={weekStart} occurrences={occurrences} plans={plans} isLoading={false} />
          </div>
        );
      })}
    </div>
  );
}
