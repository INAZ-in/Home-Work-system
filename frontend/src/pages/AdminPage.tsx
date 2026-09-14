import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { api } from "../api/client";
import { SyncLogPanel } from "../components/SyncLogPanel";
import { UserManagementPanel } from "../components/UserManagementPanel";
import type { BmstuGroupMatch } from "../types/schedule";

function formatBytes(bytes: number): string {
  const gib = bytes / (1024 * 1024 * 1024);
  if (gib >= 1) return `${gib.toFixed(2)} ГиБ`;
  const mib = bytes / (1024 * 1024);
  return `${mib.toFixed(1)} МиБ`;
}

export function AdminPage() {
  const queryClient = useQueryClient();
  const { data: semesters = [] } = useQuery({ queryKey: ["semesters"], queryFn: api.getSemesters });
  const { data: storageUsage } = useQuery({ queryKey: ["storage-usage"], queryFn: api.getStorageUsage });

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startWeekParity, setStartWeekParity] = useState<"ch" | "zn">("ch");
  const [groupQuery, setGroupQuery] = useState("");
  const [groupMatches, setGroupMatches] = useState<BmstuGroupMatch[]>([]);
  const [groupUuid, setGroupUuid] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);

  const [groupEditId, setGroupEditId] = useState<number | null>(null);
  const [groupEditQuery, setGroupEditQuery] = useState("");
  const [groupEditMatches, setGroupEditMatches] = useState<BmstuGroupMatch[]>([]);
  const [groupEditUuid, setGroupEditUuid] = useState("");
  const [groupEditError, setGroupEditError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => api.createSemester({ name, startDate, startWeekParity, bmstuGroupUuid: groupUuid || undefined }),
    onSuccess: () => {
      setName("");
      setStartDate("");
      setGroupUuid("");
      setGroupQuery("");
      setGroupMatches([]);
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => api.activateSemester(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => api.syncNow(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sync-runs"] });
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const setGroupMutation = useMutation({
    mutationFn: ({ id, uuid }: { id: number; uuid: string }) => api.setSemesterGroup(id, uuid),
    onSuccess: () => {
      setGroupEditId(null);
      setGroupEditQuery("");
      setGroupEditMatches([]);
      setGroupEditUuid("");
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
    },
  });

  const handleSearchGroup = async (): Promise<void> => {
    setSearchError(null);
    try {
      const matches = await api.findBmstuGroups(groupQuery);
      setGroupMatches(matches);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSearchGroupEdit = async (): Promise<void> => {
    setGroupEditError(null);
    try {
      const matches = await api.findBmstuGroups(groupEditQuery);
      setGroupEditMatches(matches);
    } catch (err) {
      setGroupEditError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreate = (e: FormEvent): void => {
    e.preventDefault();
    createMutation.mutate();
  };

  return (
    <div className="admin-page">
      <section className="admin-section">
        <h2>Семестры</h2>
        <ul className="semester-list">
          {semesters.map((s) => (
            <li key={s.id} className="semester-list__row">
              <div className={`semester-list__item${s.isActive ? " semester-list__item--active" : ""}`}>
                <div>
                  <strong>{s.name}</strong>
                  <span>
                    {" "}
                    — начало {s.startDate} ({s.startWeekParity === "ch" ? "числитель" : "знаменатель"})
                  </span>
                  {s.bmstuGroupUuid ? (
                    <span className="semester-list__uuid"> · группа {s.bmstuGroupUuid.slice(0, 8)}…</span>
                  ) : (
                    <span className="semester-list__uuid semester-list__uuid--missing"> · группа ЛКС не задана</span>
                  )}
                </div>
                <div className="semester-list__actions">
                  {s.isActive && <span className="semester-list__badge">активен</span>}
                  {!s.isActive && (
                    <button type="button" onClick={() => activateMutation.mutate(s.id)}>
                      Сделать активным
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (groupEditId === s.id) {
                        setGroupEditId(null);
                      } else {
                        setGroupEditId(s.id);
                        setGroupEditQuery("");
                        setGroupEditMatches([]);
                        setGroupEditUuid(s.bmstuGroupUuid ?? "");
                        setGroupEditError(null);
                      }
                    }}
                  >
                    {s.bmstuGroupUuid ? "Изменить группу" : "Указать группу"}
                  </button>
                </div>
              </div>
              {groupEditId === s.id && (
                <div className="admin-form__group-search">
                  <span className="admin-form__label">Группа в ЛКС (поиск)</span>
                  <div className="admin-form__group-search-row">
                    <input
                      value={groupEditQuery}
                      onChange={(e) => setGroupEditQuery(e.target.value)}
                      placeholder="напр. ИУ8-13"
                    />
                    <button type="button" onClick={handleSearchGroupEdit}>
                      Найти
                    </button>
                  </div>
                  {groupEditError && <p className="form-error">{groupEditError}</p>}
                  {groupEditMatches.length > 0 && (
                    <ul className="admin-form__group-matches">
                      {groupEditMatches.map((m) => (
                        <li key={m.uuid}>
                          <button type="button" onClick={() => setGroupEditUuid(m.uuid)}>
                            {m.name} <span className="admin-form__group-path">{m.path}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {groupEditUuid && <p className="admin-form__selected-uuid">Выбрано: {groupEditUuid}</p>}
                  {setGroupMutation.isError && (
                    <p className="form-error">{(setGroupMutation.error as Error).message}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => groupEditUuid && setGroupMutation.mutate({ id: s.id, uuid: groupEditUuid })}
                    disabled={!groupEditUuid || setGroupMutation.isPending}
                  >
                    Сохранить группу
                  </button>
                </div>
              )}
            </li>
          ))}
          {semesters.length === 0 && <li>Семестров пока нет.</li>}
        </ul>

        <form className="admin-form" onSubmit={handleCreate}>
          <h3>Новый семестр</h3>
          <label>
            Название
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Дата начала (понедельник 1-й недели)
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
          <label>
            Чётность 1-й недели
            <select value={startWeekParity} onChange={(e) => setStartWeekParity(e.target.value as "ch" | "zn")}>
              <option value="ch">Числитель</option>
              <option value="zn">Знаменатель</option>
            </select>
          </label>

          <div className="admin-form__group-search">
            <span className="admin-form__label">Группа в ЛКС (поиск)</span>
            <div className="admin-form__group-search-row">
              <input value={groupQuery} onChange={(e) => setGroupQuery(e.target.value)} placeholder="напр. ИУ8-13" />
              <button type="button" onClick={handleSearchGroup}>
                Найти
              </button>
            </div>
            {searchError && <p className="form-error">{searchError}</p>}
            {groupMatches.length > 0 && (
              <ul className="admin-form__group-matches">
                {groupMatches.map((m) => (
                  <li key={m.uuid}>
                    <button type="button" onClick={() => setGroupUuid(m.uuid)}>
                      {m.name} <span className="admin-form__group-path">{m.path}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {groupUuid && <p className="admin-form__selected-uuid">Выбрано: {groupUuid}</p>}
          </div>

          {createMutation.isError && <p className="form-error">{(createMutation.error as Error).message}</p>}
          <button type="submit" disabled={createMutation.isPending}>
            Создать семестр
          </button>
        </form>
      </section>

      <section className="admin-section">
        <div className="admin-section__header">
          <h2>Синхронизация с ЛКС</h2>
          <button type="button" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            {syncMutation.isPending ? "Синхронизация…" : "Синхронизировать сейчас"}
          </button>
        </div>
        <SyncLogPanel />
      </section>

      {storageUsage && (
        <section className="admin-section">
          <h2>Хранилище файлов домашних заданий</h2>
          <div className="storage-usage__bar">
            <div
              className={`storage-usage__bar-fill${
                storageUsage.usedBytes / storageUsage.totalBytes >= 0.9 ? " storage-usage__bar-fill--full" : ""
              }`}
              style={{ width: `${Math.min(100, (storageUsage.usedBytes / storageUsage.totalBytes) * 100)}%` }}
            />
          </div>
          <p className="storage-usage__meta">
            {formatBytes(storageUsage.usedBytes)} из {formatBytes(storageUsage.totalBytes)} · {storageUsage.fileCount}{" "}
            файлов
          </p>
        </section>
      )}

      <section className="admin-section">
        <h2>Пользователи</h2>
        <UserManagementPanel />
      </section>
    </div>
  );
}
