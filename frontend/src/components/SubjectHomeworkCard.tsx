import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useUser } from "../context/UserContext";
import type { SubjectHomeworkEntry } from "../types/schedule";
import { dayNameRu, formatDayMonth } from "../utils/date";
import { HomeworkFiles } from "./HomeworkFiles";
import { TYPE_LABELS } from "./LessonCard";

interface Props {
  subject: string;
  entry: SubjectHomeworkEntry;
}

export function SubjectHomeworkCard({ subject, entry }: Props) {
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  const [comment, setComment] = useState(entry.comment);
  const [done, setDone] = useState(entry.done);

  useEffect(() => {
    setComment(entry.comment);
    setDone(entry.done);
  }, [entry.comment, entry.done]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["subject-homework", subject] });

  const commentMutation = useMutation({
    mutationFn: (value: string) => api.updateComment(entry.lessonTemplateId, entry.occurrenceDate, value, entry.dueDate),
    onSuccess: invalidate,
  });

  const doneMutation = useMutation({
    mutationFn: (value: boolean) => api.updateDone(entry.lessonTemplateId, entry.occurrenceDate, value),
    onError: () => setDone(entry.done),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteHomework(entry.lessonTemplateId, entry.occurrenceDate),
    onSuccess: invalidate,
  });

  const handleToggleDone = (): void => {
    const next = !done;
    setDone(next);
    doneMutation.mutate(next);
  };

  const handleBlur = (): void => {
    if (comment !== entry.comment) commentMutation.mutate(comment);
  };

  const handleDelete = (): void => {
    if (window.confirm("Удалить это дз? Отметки «выполнено» у всех тоже пропадут.")) {
      deleteMutation.mutate();
    }
  };

  const typeLabel = TYPE_LABELS[entry.type] ?? entry.type;

  return (
    <div className={`subject-hw-card${done ? " subject-hw-card--done" : ""}`}>
      <div className="subject-hw-card__head">
        <span className="subject-hw-card__date">
          {dayNameRu(entry.occurrenceDate)}, {formatDayMonth(entry.occurrenceDate)}
        </span>
        {typeLabel && <span className="lesson-card__type">{typeLabel}</span>}
        {(entry.teacher || entry.room) && (
          <span className="lesson-card__meta">
            {entry.teacher} {entry.room}
          </span>
        )}
      </div>
      <label className="hw-editor__done">
        <input type="checkbox" checked={done} onChange={handleToggleDone} />
        <span>Выполнено</span>
      </label>
      <textarea
        className="hw-editor__comment"
        value={comment}
        placeholder="Что задали?"
        rows={2}
        onChange={(e) => setComment(e.target.value)}
        onBlur={handleBlur}
      />
      <HomeworkFiles templateId={entry.lessonTemplateId} date={entry.occurrenceDate} files={entry.files} onChanged={invalidate} />
      {entry.updatedBy && <div className="hw-editor__meta">изменил(а) {entry.updatedBy}</div>}
      {currentUser?.isAdmin && (
        <button type="button" className="hw-editor__delete-btn" onClick={handleDelete} disabled={deleteMutation.isPending}>
          Удалить дз
        </button>
      )}
      {deleteMutation.isError && <p className="form-error">{(deleteMutation.error as Error).message}</p>}
    </div>
  );
}
