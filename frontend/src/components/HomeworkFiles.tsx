import { useMutation } from "@tanstack/react-query";
import { type ChangeEvent, useRef, useState } from "react";
import { api } from "../api/client";
import type { HomeworkFileMeta } from "../types/schedule";

interface Props {
  templateId: number;
  date: string;
  files: HomeworkFileMeta[];
  onChanged: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function HomeworkFiles({ templateId, date, files, onChanged }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadHomeworkFile(templateId, date, file),
    onSuccess: () => {
      setError(null);
      onChanged();
    },
    onError: (err) => setError((err as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId: number) => api.deleteHomeworkFile(fileId),
    onSuccess: onChanged,
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
    api.downloadHomeworkFile(file.id, file.filename).catch((err) => setError((err as Error).message));
  };

  return (
    <div className="hw-files" onClick={(e) => e.stopPropagation()}>
      {files.length > 0 && (
        <ul className="hw-files__list">
          {files.map((f) => (
            <li key={f.id}>
              <button type="button" className="hw-files__name" onClick={() => handleDownload(f)}>
                {f.filename}
              </button>
              <span className="hw-files__size">{formatSize(f.sizeBytes)}</span>
              <button
                type="button"
                className="hw-files__delete"
                onClick={() => handleDelete(f)}
                disabled={deleteMutation.isPending}
                title="Удалить файл"
              >
                ×
              </button>
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
