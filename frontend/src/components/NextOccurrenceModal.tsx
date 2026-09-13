import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { dayNameRu, formatDayMonth } from "../utils/date";

interface Props {
  templateId: number;
  /** Search for the next occurrence strictly after this date (usually the lesson happening right now). */
  afterDate: string;
  onClose: () => void;
}

export function NextOccurrenceModal({ templateId, afterDate, onClose }: Props) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["next-occurrence", templateId, afterDate],
    queryFn: () => api.getNextOccurrence(templateId, afterDate),
  });
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (data) setComment(data.homework?.comment ?? "");
  }, [data]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const saveMutation = useMutation({
    mutationFn: () => api.updateComment(templateId, data!.date, comment, null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      onClose();
    },
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <div className="modal__title">{data ? data.subject : "Следующее занятие"}</div>
            {data && (
              <div className="modal__subtitle">
                {dayNameRu(data.date)}, {formatDayMonth(data.date)} · {data.pair.start}–{data.pair.end}
              </div>
            )}
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="modal__body">
          {isLoading && <p>Загрузка…</p>}
          {isError && <p className="form-error">Не нашли следующее занятие по этому предмету в расписании.</p>}
          {data && (
            <>
              <textarea
                rows={4}
                placeholder="Что задать на это занятие?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                autoFocus
              />
              <div className="modal__actions">
                <button type="button" onClick={onClose}>
                  Отмена
                </button>
                <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  Сохранить
                </button>
              </div>
              {saveMutation.isError && <p className="form-error">{(saveMutation.error as Error).message}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
