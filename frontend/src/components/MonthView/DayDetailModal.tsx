import { useEffect } from "react";
import type { PersonalPlan, ScheduleOccurrence } from "../../types/schedule";
import { dayNameRu, formatDayMonth } from "../../utils/date";
import { LessonCard } from "../LessonCard";
import { PersonalPlanCard } from "../PersonalPlanCard";

interface Props {
  date: string;
  occurrences: ScheduleOccurrence[];
  plans?: PersonalPlan[];
  onClose: () => void;
}

export function DayDetailModal({ date, occurrences, plans = [], onClose }: Props) {
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
          {plans.length > 0 && (
            <div className="day-column__plans">
              {plans.map((plan) => (
                <PersonalPlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          )}
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
