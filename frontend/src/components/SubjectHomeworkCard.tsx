import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useUser } from "../context/UserContext";
import type { HomeworkKind, SubjectHomeworkEntry } from "../types/schedule";
import { dayNameRu, formatDayMonth } from "../utils/date";
import { CollapsibleTextarea } from "./CollapsibleTextarea";
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
  const [kind, setKind] = useState<HomeworkKind>(entry.kind);

  useEffect(() => {
    setComment(entry.comment);
    setDone(entry.done);
    setKind(entry.kind);
  }, [entry.comment, entry.done, entry.kind]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["subject-homework", subject] });
    queryClient.invalidateQueries({ queryKey: ["subjects-modular-pending"] });
    queryClient.invalidateQueries({ queryKey: ["subjects-pending"] });
  };

  const commentMutation = useMutation({
    mutationFn: ({ value, kindValue }: { value: string; kindValue: HomeworkKind }) =>
      api.updateComment(entry.lessonTemplateId, entry.occurrenceDate, value, entry.dueDate, kindValue),
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
    if (comment !== entry.comment) commentMutation.mutate({ value: comment, kindValue: kind });
  };

  const handleKindChange = (modular: boolean): void => {
    const value: HomeworkKind = modular ? "modular" : "regular";
    setKind(value);
    commentMutation.mutate({ value: comment, kindValue: value });
  };

  const handleDelete = (): void => {
    if (window.confirm("Удалить это дз? Отметки «выполнено» у всех тоже пропадут.")) {
      deleteMutation.mutate();
    }
  };

  const typeLabel = TYPE_LABELS[entry.type] ?? entry.type;
  // A full admin may delete/edit any entry; a "group admin" only within
  // their own foreign-language/descriptive-geometry subgroup — matches the
  // backend's DELETE /occurrences and elevated PUT .../comment rules (see
  // routes/homework.ts). A plain user may only ADD homework — once real
  // text exists, further edits (and removing an attached file) require one
  // of the roles above.
  const canDelete = currentUser?.isAdmin || (currentUser?.groupAdmin && entry.subgroupLabel !== null);
  const commentAlreadyEntered = Boolean(entry.comment.trim());
  const canEditContent = canDelete || !commentAlreadyEntered;

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
      <label className="hw-editor__modular">
        <input
          type="checkbox"
          checked={kind === "modular"}
          onChange={(e) => handleKindChange(e.target.checked)}
          disabled={!canEditContent}
        />
        <span>Модульное дз</span>
      </label>
      <CollapsibleTextarea
        value={comment}
        savedValue={entry.comment}
        onChange={setComment}
        onBlur={handleBlur}
        placeholder="Что задали?"
        readOnly={!canEditContent}
      />
      <HomeworkFiles
        templateId={entry.lessonTemplateId}
        date={entry.occurrenceDate}
        files={entry.files}
        onChanged={invalidate}
        canDelete={Boolean(canDelete)}
      />
      {entry.updatedBy && <div className="hw-editor__meta">изменил(а) {entry.updatedBy}</div>}
      {canDelete && (
        <button type="button" className="hw-editor__delete-btn" onClick={handleDelete} disabled={deleteMutation.isPending}>
          Удалить дз
        </button>
      )}
      {deleteMutation.isError && <p className="form-error">{(deleteMutation.error as Error).message}</p>}
    </div>
  );
}
