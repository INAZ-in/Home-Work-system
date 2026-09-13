import type { CSSProperties } from "react";
import type { ScheduleOccurrence } from "../../types/schedule";
import { subjectColor } from "../../utils/subjectColor";

const MAX_VISIBLE = 3;

interface Props {
  date: string;
  occurrences: ScheduleOccurrence[];
  inCurrentMonth: boolean;
  isToday: boolean;
  onSelect: () => void;
}

export function MonthDayCell({ date, occurrences, inCurrentMonth, isToday, onSelect }: Props) {
  const dayNum = Number(date.slice(8, 10));
  const visible = occurrences.slice(0, MAX_VISIBLE);
  const hiddenCount = occurrences.length - visible.length;
  const hasUndoneHomework = occurrences.some((o) => o.homework?.comment && !o.done);

  const classes = ["month-cell"];
  if (!inCurrentMonth) classes.push("month-cell--outside");
  if (isToday) classes.push("month-cell--today");

  return (
    <button type="button" className={classes.join(" ")} onClick={onSelect}>
      <div className="month-cell__date">
        <span>{dayNum}</span>
        {hasUndoneHomework && <span className="month-cell__flag" title="Есть невыполненное дз" />}
      </div>
      {occurrences.length > 0 && (
        <div className="month-cell__lessons">
          {visible.map((occ) => (
            <span
              key={`${occ.lessonTemplateId}-${occ.date}`}
              className="month-cell__dot"
              style={{ "--subject-color": subjectColor(occ.subject) } as CSSProperties}
              title={occ.subject}
            />
          ))}
          {hiddenCount > 0 && <span className="month-cell__more">+{hiddenCount}</span>}
        </div>
      )}
    </button>
  );
}
