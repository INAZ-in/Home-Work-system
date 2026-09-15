import { useMemo, useState } from "react";
import { DayView } from "../components/DayView";
import { MonthGrid } from "../components/MonthView/MonthGrid";
import { UpcomingEvents } from "../components/UpcomingEvents";
import { TwoWeekView } from "../components/WeekView/TwoWeekView";
import { ViewToggle, type ViewMode } from "../components/ViewToggle";
import { WeekView, type WeekLayout } from "../components/WeekView/WeekView";
import { useOverview } from "../hooks/useOverview";
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
  // Only meaningful for week/twoWeeks — "timeline" is today's default
  // (WeekTimeGrid, lessons aligned to a shared clock-time axis); "list"
  // stacks each day's lessons top-aligned one after another instead, with
  // no gap rows for times another day doesn't have.
  const [weekLayout, setWeekLayout] = useState<WeekLayout>("timeline");

  const { from, to } = useMemo(() => {
    if (viewMode === "day") return { from: anchorDate, to: anchorDate };
    const start = startOfWeek(anchorDate);
    if (viewMode === "week") return { from: start, to: addDays(start, 6) };
    if (viewMode === "twoWeeks") return { from: start, to: addDays(start, 13) };
    const dates = monthGridDates(anchorDate);
    return { from: dates[0], to: dates[dates.length - 1] };
  }, [viewMode, anchorDate]);

  const { data, isLoading, isFetching } = useOverview(from, to);
  const occurrences = data?.occurrences ?? [];
  const plans = data?.plans ?? [];

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
      <UpcomingEvents />
      <ViewToggle
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        label={label}
      />
      {(viewMode === "week" || viewMode === "twoWeeks") && (
        <div className="view-toggle__segmented week-layout-toggle">
          <button
            type="button"
            className={weekLayout === "timeline" ? "active" : ""}
            onClick={() => setWeekLayout("timeline")}
          >
            По времени
          </button>
          <button type="button" className={weekLayout === "list" ? "active" : ""} onClick={() => setWeekLayout("list")}>
            Списком
          </button>
        </div>
      )}
      {viewMode === "day" && (
        <DayView date={anchorDate} occurrences={occurrences} plans={plans} isLoading={isLoading || isFetching} />
      )}
      {viewMode === "week" && (
        <WeekView
          anchorDate={anchorDate}
          occurrences={occurrences}
          plans={plans}
          isLoading={isLoading || isFetching}
          layout={weekLayout}
        />
      )}
      {viewMode === "twoWeeks" && (
        <TwoWeekView
          anchorDate={anchorDate}
          occurrences={occurrences}
          plans={plans}
          isLoading={isLoading || isFetching}
          layout={weekLayout}
        />
      )}
      {viewMode === "month" && (
        <MonthGrid anchorDate={anchorDate} occurrences={occurrences} plans={plans} isLoading={isLoading || isFetching} />
      )}
    </div>
  );
}
