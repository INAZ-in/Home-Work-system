import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useUser } from "../context/UserContext";
import type { ScheduleOccurrence } from "../types/schedule";
import { HomeworkFiles } from "./HomeworkFiles";
import { NextOccurrenceModal } from "./NextOccurrenceModal";

interface Props {
  occurrence: ScheduleOccurrence;
}

export function HomeworkEditor({ occurrence }: Props) {
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  const savedComment = occurrence.homework?.comment ?? "";
  const [comment, setComment] = useState(savedComment);
  const [done, setDone] = useState(occurrence.done);
  const [expanded, setExpanded] = useState(Boolean(savedComment));
  const [showNextModal, setShowNextModal] = useState(false);

  useEffect(() => {
    setComment(savedComment);
    setDone(occurrence.done);
    setExpanded(Boolean(savedComment));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedComment, occurrence.done]);

  const commentMutation = useMutation({
    mutationFn: (value: string) => api.updateComment(occurrence.lessonTemplateId, occurrence.date, value, null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedule"] }),
  });

  const doneMutation = useMutation({
    mutationFn: (value: boolean) => api.updateDone(occurrence.lessonTemplateId, occurrence.date, value),
    onError: () => setDone(occurrence.done),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedule"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteHomework(occurrence.lessonTemplateId, occurrence.date),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedule"] }),
  });

  const handleToggleDone = (): void => {
    const next = !done;
    setDone(next);
    doneMutation.mutate(next);
  };

  const handleBlur = (): void => {
    if (comment !== savedComment) {
      commentMutation.mutate(comment);
    }
  };

  const handleDelete = (): void => {
    if (window.confirm("Удалить это дз? Отметки «выполнено» у всех тоже пропадут.")) {
      deleteMutation.mutate();
    }
  };

  // No homework assigned yet — nothing to mark as done.
  const hasHomework = Boolean(savedComment.trim()) || Boolean(occurrence.homework?.files.length);

  return (
    <div className="hw-editor" onClick={(e) => e.stopPropagation()}>
      {hasHomework && (
        <label className="hw-editor__done">
          <input type="checkbox" checked={done} onChange={handleToggleDone} />
          <span>Выполнено</span>
        </label>
      )}
      {expanded && (
        <textarea
          className="hw-editor__comment"
          value={comment}
          placeholder="Что задали?"
          rows={2}
          onChange={(e) => setComment(e.target.value)}
          onBlur={handleBlur}
        />
      )}
      <div className="hw-editor__actions">
        {!expanded && (
          <button type="button" className="hw-editor__add-btn" onClick={() => setExpanded(true)}>
            + добавить дз
          </button>
        )}
        <button type="button" className="hw-editor__next-btn" onClick={() => setShowNextModal(true)}>
          дз на след. занятие →
        </button>
        {currentUser?.isAdmin && hasHomework && (
          <button
            type="button"
            className="hw-editor__delete-btn"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            Удалить дз
          </button>
        )}
      </div>
      <HomeworkFiles
        templateId={occurrence.lessonTemplateId}
        date={occurrence.date}
        files={occurrence.homework?.files ?? []}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ["schedule"] })}
      />
      {occurrence.homework?.updatedBy && <div className="hw-editor__meta">изменил(а) {occurrence.homework.updatedBy}</div>}
      {deleteMutation.isError && <p className="form-error">{(deleteMutation.error as Error).message}</p>}
      {showNextModal && (
        <NextOccurrenceModal
          templateId={occurrence.lessonTemplateId}
          afterDate={occurrence.date}
          onClose={() => setShowNextModal(false)}
        />
      )}
    </div>
  );
}
