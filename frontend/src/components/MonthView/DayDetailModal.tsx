import { useEffect } from "react";
import type { ScheduleOccurrence } from "../../types/schedule";
import { dayNameRu, formatDayMonth } from "../../utils/date";
import { LessonCard } from "../LessonCard";

interface Props {
  date: string;
  occurrences: ScheduleOccurrence[];
  onClose: () => void;
}

export function DayDetailModal({ date, occurrences, onClose }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <div className="modal__title">{dayNameRu(date)}</div>
            <div className="modal__subtitle">{formatDayMonth(date)}</div>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="modal__body">
          {occurrences.length === 0 ? (
            <div className="day-column__empty">Нет пар</div>
          ) : (
            occurrences.map((occ) => <LessonCard key={`${occ.lessonTemplateId}-${occ.date}`} occurrence={occ} />)
          )}
        </div>
      </div>
    </div>
  );
}
