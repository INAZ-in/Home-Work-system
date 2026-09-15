import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import { LESSON_EVENT_LABELS, type LessonEventType, type ScheduleOccurrence } from "../types/schedule";

const EVENT_TYPES = Object.keys(LESSON_EVENT_LABELS) as LessonEventType[];

interface Props {
  occurrence: ScheduleOccurrence;
}

/**
 * Admin-only "⋮" menu on a lesson card — marks (or clears) this specific
 * occurrence as an upcoming event (РК/КР/Конец модуля/Работка), surfaced in
 * the "Предстоящие мероприятия" block. The dropdown renders through a portal
 * with fixed positioning, since lesson cards clip overflow for their rounded
 * corners/color bar and would otherwise cut the menu off.
 */
export function LessonEventMenu({ occurrence }: Props) {
  const queryClient = useQueryClient();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const mutation = useMutation({
    mutationFn: (eventType: LessonEventType | null) =>
      api.setOccurrenceEvent(occurrence.lessonTemplateId, occurrence.date, eventType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-events"] });
      setPosition(null);
    },
  });

  const handleToggle = (): void => {
    if (position) {
      setPosition(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, left: rect.right });
  };

  return (
    <div className="lesson-event-menu" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        ref={triggerRef}
        className="lesson-event-menu__trigger"
        onClick={handleToggle}
        aria-label="Отметить мероприятие"
      >
        ⋮
      </button>
      {position &&
        createPortal(
          <>
            <div className="lesson-event-menu__backdrop" onClick={() => setPosition(null)} />
            <div
              className="lesson-event-menu__dropdown"
              style={{ top: position.top, left: position.left }}
            >
              {EVENT_TYPES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={occurrence.event === value ? "active" : ""}
                  onClick={() => mutation.mutate(value)}
                  disabled={mutation.isPending}
                >
                  {LESSON_EVENT_LABELS[value]}
                </button>
              ))}
              {occurrence.event && (
                <button
                  type="button"
                  className="lesson-event-menu__clear"
                  onClick={() => mutation.mutate(null)}
                  disabled={mutation.isPending}
                >
                  Убрать отметку
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
