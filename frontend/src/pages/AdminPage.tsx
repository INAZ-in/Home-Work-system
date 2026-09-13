import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { api } from "../api/client";
import { SyncLogPanel } from "../components/SyncLogPanel";
import { UserManagementPanel } from "../components/UserManagementPanel";
import type { BmstuGroupMatch } from "../types/schedule";

export function AdminPage() {
  const queryClient = useQueryClient();
  const { data: semesters = [] } = useQuery({ queryKey: ["semesters"], queryFn: api.getSemesters });

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startWeekParity, setStartWeekParity] = useState<"ch" | "zn">("ch");
  const [groupQuery, setGroupQuery] = useState("");
  const [groupMatches, setGroupMatches] = useState<BmstuGroupMatch[]>([]);
  const [groupUuid, setGroupUuid] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);

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
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => api.syncNow(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sync-runs"] });
      await queryClient.invalidateQueries({ queryKey: ["schedule"] });
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
            <li key={s.id} className={`semester-list__item${s.isActive ? " semester-list__item--active" : ""}`}>
              <div>
                <strong>{s.name}</strong>
                <span>
                  {" "}
                  — начало {s.startDate} ({s.startWeekParity === "ch" ? "числитель" : "знаменатель"})
                </span>
                {s.bmstuGroupUuid && <span className="semester-list__uuid"> · группа {s.bmstuGroupUuid.slice(0, 8)}…</span>}
              </div>
              {s.isActive ? (
                <span className="semester-list__badge">активен</span>
              ) : (
                <button type="button" onClick={() => activateMutation.mutate(s.id)}>
                  Сделать активным
                </button>
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

      <section className="admin-section">
        <h2>Пользователи</h2>
        <UserManagementPanel />
      </section>
    </div>
  );
}
