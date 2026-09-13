import type { CSSProperties } from "react";
import type { ScheduleOccurrence } from "../types/schedule";
import { isHappeningNow } from "../utils/date";
import { subjectColor } from "../utils/subjectColor";
import { HomeworkEditor } from "./HomeworkEditor";

export const TYPE_LABELS: Record<string, string> = {
  lecture: "лекция",
  seminar: "семинар",
  lab: "лаб.",
  generated: "",
  "": "",
};

interface Props {
  occurrence: ScheduleOccurrence;
  compact?: boolean;
}

export function LessonCard({ occurrence, compact = false }: Props) {
  const color = subjectColor(occurrence.subject);
  const typeLabel = TYPE_LABELS[occurrence.type] ?? occurrence.type;
  const hasHomework = Boolean(occurrence.homework?.comment) || Boolean(occurrence.homework?.files.length);
  const style = { "--subject-color": color } as CSSProperties;

  const classes = ["lesson-card"];
  if (compact) classes.push("lesson-card--compact");
  if (occurrence.done) classes.push("lesson-card--done");
  if (isHappeningNow(occurrence.date, occurrence.pair.start, occurrence.pair.end)) classes.push("lesson-card--now");

  return (
    <div className={classes.join(" ")} style={style}>
      <div className="lesson-card__bar" />
      <div className="lesson-card__body">
        <div className="lesson-card__head">
          <span className="lesson-card__time">
            {compact ? occurrence.pair.start : `${occurrence.pair.start}–${occurrence.pair.end}`}
          </span>
          <span className="lesson-card__subject">{occurrence.subject}</span>
          {typeLabel && <span className="lesson-card__type">{typeLabel}</span>}
          {occurrence.subgroupLabel && <span className="lesson-card__type">{occurrence.subgroupLabel}</span>}
          {hasHomework && <span className="lesson-card__hw-dot" title="Есть дз" />}
        </div>
        {!compact && (
          <>
            {(occurrence.teacher || occurrence.room) && (
              <div className="lesson-card__meta">
                {occurrence.teacher && <span>{occurrence.teacher}</span>}
                {occurrence.room && <span>{occurrence.room}</span>}
              </div>
            )}
            <HomeworkEditor occurrence={occurrence} />
          </>
        )}
      </div>
    </div>
  );
}
