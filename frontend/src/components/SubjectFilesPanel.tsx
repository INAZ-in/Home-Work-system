import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useRef, useState } from "react";
import { api } from "../api/client";
import { useUser } from "../context/UserContext";
import type { HomeworkFileMeta } from "../types/schedule";
import { formatDayMonth } from "../utils/date";

interface Props {
  subject: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * Subject-wide study files (textbooks, reference materials) — unlike a
 * homework attachment these aren't tied to one lesson occurrence or
 * subgroup, so every viewer of this subject sees the same shared list.
 * Anyone may attach a file; only a full admin may remove one, since there's
 * no subgroup here to scope a junior admin's delete rights to.
 */
export function SubjectFilesPanel({ subject }: Props) {
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["subject-files", subject],
    queryFn: () => api.getSubjectFiles(subject),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["subject-files", subject] });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadSubjectFile(subject, file),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError((err as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId: number) => api.deleteSubjectFile(fileId),
    onSuccess: invalidate,
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  };

  const handleDelete = (file: HomeworkFileMeta): void => {
    if (window.confirm(`Удалить файл «${file.filename}»?`)) deleteMutation.mutate(file.id);
  };

  const handleDownload = (file: HomeworkFileMeta): void => {
    api.downloadSubjectFile(file.id, file.filename).catch((err) => setError((err as Error).message));
  };

  return (
    <div className="subject-files">
      {isLoading && <p className="subjects-page__empty">Загрузка…</p>}
      {!isLoading && files.length === 0 && <p className="subjects-page__empty">Файлов пока нет.</p>}
      {files.length > 0 && (
        <ul className="subject-files__list">
          {files.map((f) => (
            <li key={f.id} className="subject-files__item">
              <button type="button" className="hw-files__name" onClick={() => handleDownload(f)}>
                {f.filename}
              </button>
              <span className="hw-files__size">{formatSize(f.sizeBytes)}</span>
              <span className="subject-files__meta">
                {f.uploadedBy ?? "—"}, {formatDayMonth(f.uploadedAt.slice(0, 10))}
              </span>
              {currentUser?.isAdmin && (
                <button
                  type="button"
                  className="hw-files__delete"
                  onClick={() => handleDelete(f)}
                  disabled={deleteMutation.isPending}
                  title="Удалить файл"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="hw-files__add-btn"
        onClick={() => inputRef.current?.click()}
        disabled={uploadMutation.isPending}
      >
        {uploadMutation.isPending ? "Загрузка…" : "+ прикрепить файл"}
      </button>
      <input ref={inputRef} type="file" hidden onChange={handleFileChange} />
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
