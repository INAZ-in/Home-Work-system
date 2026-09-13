export type ViewMode = "day" | "week" | "twoWeeks" | "month";

interface Props {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  label: string;
}

const MODES: { value: ViewMode; label: string }[] = [
  { value: "day", label: "День" },
  { value: "week", label: "Неделя" },
  { value: "twoWeeks", label: "2 недели" },
  { value: "month", label: "Месяц" },
];

export function ViewToggle({ viewMode, onViewModeChange, onPrev, onNext, onToday, label }: Props) {
  return (
    <div className="view-toggle">
      <div className="view-toggle__nav">
        <button type="button" className="view-toggle__arrow" onClick={onPrev} aria-label="Назад">
          ‹
        </button>
        <button type="button" className="view-toggle__today" onClick={onToday}>
          Сегодня
        </button>
        <button type="button" className="view-toggle__arrow" onClick={onNext} aria-label="Вперёд">
          ›
        </button>
        <span className="view-toggle__label">{label}</span>
      </div>
      <div className="view-toggle__segmented">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            className={viewMode === m.value ? "active" : ""}
            onClick={() => onViewModeChange(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
