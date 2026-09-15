import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { LESSON_EVENT_LABELS } from "../types/schedule";
import { dayNameRu, formatDayMonth } from "../utils/date";
import { TYPE_LABELS } from "./LessonCard";

/** Schedule-wide list of admin-marked events (РК/КР/Конец модуля/Работка) from today onward — set per lesson occurrence via the "⋮" menu on a lesson card (see LessonEventMenu). */
export function UpcomingEvents() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["upcoming-events"],
    queryFn: api.getUpcomingEvents,
  });

  if (isLoading || events.length === 0) return null;

  return (
    <section className="upcoming-events">
      <h2 className="upcoming-events__title">Предстоящие мероприятия</h2>
      <ul className="upcoming-events__list">
        {events.map((e) => (
          <li key={`${e.lessonTemplateId}-${e.date}`} className="upcoming-events__item">
            <span className="upcoming-events__date">
              {dayNameRu(e.date)}, {formatDayMonth(e.date)}
            </span>
            <span className="upcoming-events__subject">{e.subject}</span>
            {TYPE_LABELS[e.type] && <span className="lesson-card__type">{TYPE_LABELS[e.type]}</span>}
            <span className="upcoming-events__badge">{LESSON_EVENT_LABELS[e.eventType]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
