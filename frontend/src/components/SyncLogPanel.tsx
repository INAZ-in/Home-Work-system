import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export function SyncLogPanel() {
  const { data: runs = [], isLoading } = useQuery({ queryKey: ["sync-runs"], queryFn: api.getSyncRuns });

  if (isLoading) return <p>Загрузка истории…</p>;
  if (runs.length === 0) return <p>Синхронизаций ещё не было.</p>;

  return (
    <ul className="sync-log">
      {runs.map((run) => (
        <li key={run.id} className={`sync-log__item sync-log__item--${run.status}`}>
          <div className="sync-log__head">
            <span>{new Date(run.runAt).toLocaleString("ru-RU")}</span>
            <span className="sync-log__status">{run.status === "ok" ? "OK" : "Ошибка"}</span>
          </div>
          {run.status === "ok" ? (
            <div className="sync-log__counts">
              +{run.addedCount} новых, ~{run.updatedCount} изменено, −{run.deactivatedCount} убрано
            </div>
          ) : (
            <div className="sync-log__error">{run.error}</div>
          )}
          {run.details.length > 0 && (
            <ul className="sync-log__details">
              {run.details.map((d, i) => (
                <li key={i}>
                  {d.type === "added" && `+ добавлено: ${d.subject} (день ${d.day}, пара ${d.pair}, ${d.parity})`}
                  {d.type === "deactivated" && `− убрано: ${d.subject} (день ${d.day}, пара ${d.pair}, ${d.parity})`}
                  {d.type === "updated" && `~ ${d.subject}: ${d.field} "${d.old}" → "${d.new}"`}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
