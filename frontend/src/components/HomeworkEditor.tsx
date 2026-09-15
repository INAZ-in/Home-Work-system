import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useUser } from "../context/UserContext";
import type { HomeworkKind, ScheduleOccurrence } from "../types/schedule";
import { CollapsibleTextarea } from "./CollapsibleTextarea";
import { HomeworkFiles } from "./HomeworkFiles";
import { NextOccurrenceModal } from "./NextOccurrenceModal";

interface Props {
  occurrence: ScheduleOccurrence;
}

export function HomeworkEditor({ occurrence }: Props) {
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  const savedComment = occurrence.homework?.comment ?? "";
  const savedKind = occurrence.homework?.kind ?? "regular";
  const [comment, setComment] = useState(savedComment);
  const [kind, setKind] = useState<HomeworkKind>(savedKind);
  const [done, setDone] = useState(occurrence.done);
  const [expanded, setExpanded] = useState(Boolean(savedComment));
  const [showNextModal, setShowNextModal] = useState(false);

  useEffect(() => {
    setComment(savedComment);
    setKind(savedKind);
    setDone(occurrence.done);
    setExpanded(Boolean(savedComment));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedComment, savedKind, occurrence.done]);

  const invalidatePendingQueries = (): void => {
    queryClient.invalidateQueries({ queryKey: ["overview"] });
    queryClient.invalidateQueries({ queryKey: ["subjects-modular-pending"] });
    queryClient.invalidateQueries({ queryKey: ["subjects-pending"] });
  };

  const commentMutation = useMutation({
    mutationFn: ({ value, kindValue }: { value: string; kindValue: HomeworkKind }) =>
      api.updateComment(occurrence.lessonTemplateId, occurrence.date, value, null, kindValue),
    onSuccess: invalidatePendingQueries,
  });

  const doneMutation = useMutation({
    mutationFn: (value: boolean) => api.updateDone(occurrence.lessonTemplateId, occurrence.date, value),
    onError: () => setDone(occurrence.done),
    onSuccess: invalidatePendingQueries,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteHomework(occurrence.lessonTemplateId, occurrence.date),
    onSuccess: invalidatePendingQueries,
  });

  const handleToggleDone = (): void => {
    const next = !done;
    setDone(next);
    doneMutation.mutate(next);
  };

  const handleBlur = (): void => {
    if (comment !== savedComment) {
      commentMutation.mutate({ value: comment, kindValue: kind });
    }
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

  // No homework assigned yet — nothing to mark as done.
  const hasHomework = Boolean(savedComment.trim()) || Boolean(occurrence.homework?.files.length);
  // A full admin may delete/edit any occurrence; a "group admin" only within
  // their own foreign-language/descriptive-geometry subgroup — matches the
  // backend's DELETE /occurrences and elevated PUT .../comment rules (see
  // routes/homework.ts). A plain user may only ADD homework — once real
  // text exists, further edits (and removing an attached file) require one
  // of the roles above.
  const canDelete = currentUser?.isAdmin || (currentUser?.groupAdmin && occurrence.subgroupLabel !== null);
  const commentAlreadyEntered = Boolean(savedComment.trim());
  const canEditContent = canDelete || !commentAlreadyEntered;

  return (
    <div className="hw-editor" onClick={(e) => e.stopPropagation()}>
      {hasHomework && (
        <label className="hw-editor__done">
          <input type="checkbox" checked={done} onChange={handleToggleDone} />
          <span>Выполнено</span>
        </label>
      )}
      {expanded && (
        <label className="hw-editor__modular">
          <input
            type="checkbox"
            checked={kind === "modular"}
            onChange={(e) => handleKindChange(e.target.checked)}
            disabled={!canEditContent}
          />
          <span>Модульное дз</span>
        </label>
      )}
      {expanded && (
        <CollapsibleTextarea
          value={comment}
          savedValue={savedComment}
          onChange={setComment}
          onBlur={handleBlur}
          placeholder="Что задали?"
          readOnly={!canEditContent}
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
        {canDelete && hasHomework && (
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
        onChanged={invalidatePendingQueries}
        canDelete={Boolean(canDelete)}
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
