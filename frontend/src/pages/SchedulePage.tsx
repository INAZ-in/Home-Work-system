import { useMemo, useState } from "react";
import { DayView } from "../components/DayView";
import { MonthGrid } from "../components/MonthView/MonthGrid";
import { TwoWeekView } from "../components/WeekView/TwoWeekView";
import { ViewToggle, type ViewMode } from "../components/ViewToggle";
import { WeekView } from "../components/WeekView/WeekView";
import { useSchedule } from "../hooks/useSchedule";
import {
  addDays,
  dayNameRu,
  formatDayMonth,
  monthGridDates,
  monthLabelRu,
  shiftMonth,
  startOfWeek,
  todayISO,
} from "../utils/date";

const PHONE_BREAKPOINT = "(max-width: 640px)";

/** Phones default to the single-day view on first load — a full week stacked vertically is a lot of scrolling on a small screen. Desktop keeps the week view. */
function defaultViewMode(): ViewMode {
  return typeof window !== "undefined" && window.matchMedia(PHONE_BREAKPOINT).matches ? "day" : "week";
}

const STEP_DAYS: Record<ViewMode, number> = { day: 1, week: 7, twoWeeks: 14, month: 0 };

export function SchedulePage() {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [anchorDate, setAnchorDate] = useState(todayISO());

  const { from, to } = useMemo(() => {
    if (viewMode === "day") return { from: anchorDate, to: anchorDate };
    const start = startOfWeek(anchorDate);
    if (viewMode === "week") return { from: start, to: addDays(start, 6) };
    if (viewMode === "twoWeeks") return { from: start, to: addDays(start, 13) };
    const dates = monthGridDates(anchorDate);
    return { from: dates[0], to: dates[dates.length - 1] };
  }, [viewMode, anchorDate]);

  const { data: occurrences = [], isLoading, isFetching } = useSchedule(from, to);

  const label = useMemo(() => {
    if (viewMode === "day") return `${dayNameRu(anchorDate)}, ${formatDayMonth(anchorDate)}`;
    const start = startOfWeek(anchorDate);
    if (viewMode === "week") return `${formatDayMonth(start)} – ${formatDayMonth(addDays(start, 5))}`;
    if (viewMode === "twoWeeks") return `${formatDayMonth(start)} – ${formatDayMonth(addDays(start, 12))}`;
    return monthLabelRu(anchorDate);
  }, [viewMode, anchorDate]);

  const handlePrev = (): void =>
    setAnchorDate((d) => (viewMode === "month" ? shiftMonth(d, -1) : addDays(d, -STEP_DAYS[viewMode])));
  const handleNext = (): void =>
    setAnchorDate((d) => (viewMode === "month" ? shiftMonth(d, 1) : addDays(d, STEP_DAYS[viewMode])));
  const handleToday = (): void => setAnchorDate(todayISO());

  return (
    <div className="schedule-page">
      <ViewToggle
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        label={label}
      />
      {viewMode === "day" && (
        <DayView date={anchorDate} occurrences={occurrences} isLoading={isLoading || isFetching} />
      )}
      {viewMode === "week" && (
        <WeekView anchorDate={anchorDate} occurrences={occurrences} isLoading={isLoading || isFetching} />
      )}
      {viewMode === "twoWeeks" && (
        <TwoWeekView anchorDate={anchorDate} occurrences={occurrences} isLoading={isLoading || isFetching} />
      )}
      {viewMode === "month" && (
        <MonthGrid anchorDate={anchorDate} occurrences={occurrences} isLoading={isLoading || isFetching} />
      )}
    </div>
  );
}
