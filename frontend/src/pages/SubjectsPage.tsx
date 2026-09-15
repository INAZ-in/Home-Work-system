import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import { SubjectFilesPanel } from "../components/SubjectFilesPanel";
import { SubjectHomeworkCard } from "../components/SubjectHomeworkCard";

type Tab = "upcoming" | "done" | "modular" | "files";

export function SubjectsPage() {
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: api.getSubjects });
  const { data: modularPending = [] } = useQuery({
    queryKey: ["subjects-modular-pending"],
    queryFn: api.getModularPendingSubjects,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("upcoming");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["subject-homework", selected],
    queryFn: () => api.getSubjectHomework(selected!),
    enabled: selected !== null,
  });

  const filtered = entries
    .filter((e) => {
      if (tab === "modular") return e.kind === "modular";
      return tab === "done" ? e.done : !e.done;
    })
    .sort((a, b) => (tab === "done" ? b.occurrenceDate.localeCompare(a.occurrenceDate) : a.occurrenceDate.localeCompare(b.occurrenceDate)));

  return (
    <div className="subjects-page">
      <aside className="subjects-page__list">
        {subjects.map((s) => (
          <button
            key={s}
            type="button"
            className={`${selected === s ? "active" : ""}${modularPending.includes(s) ? " subjects-page__list-item--modular-pending" : ""}`}
            onClick={() => setSelected(s)}
          >
            {s}
          </button>
        ))}
        {subjects.length === 0 && <p className="subjects-page__empty">Предметов пока нет.</p>}
      </aside>
      <section className="subjects-page__detail">
        {selected === null ? (
          <p className="subjects-page__empty">Выберите предмет слева.</p>
        ) : (
          <>
            <h2>{selected}</h2>
            <div className="subjects-page__tabs">
              <button type="button" className={tab === "upcoming" ? "active" : ""} onClick={() => setTab("upcoming")}>
                Предстоящие
              </button>
              <button type="button" className={tab === "done" ? "active" : ""} onClick={() => setTab("done")}>
                Выполненные
              </button>
              <button type="button" className={tab === "modular" ? "active" : ""} onClick={() => setTab("modular")}>
                Модульное
              </button>
              <button type="button" className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}>
                Учебные файлы
              </button>
            </div>
            {tab === "files" ? (
              <SubjectFilesPanel subject={selected} />
            ) : (
              <>
                {isLoading && <p className="subjects-page__empty">Загрузка…</p>}
                {!isLoading && filtered.length === 0 && <p className="subjects-page__empty">Пусто.</p>}
                <div className="subjects-page__entries">
                  {filtered.map((entry) => (
                    <SubjectHomeworkCard key={`${entry.lessonTemplateId}-${entry.occurrenceDate}`} subject={selected} entry={entry} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
