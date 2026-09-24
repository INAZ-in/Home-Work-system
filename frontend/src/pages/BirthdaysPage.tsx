import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { BirthdayEntry } from "../types/schedule";
import { formatDayMonth } from "../utils/date";

const SOON_WITHIN_DAYS = 30;

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "дня";
  return "дней";
}

function formatCountdown(daysUntil: number): string {
  if (daysUntil === 0) return "сегодня!";
  if (daysUntil === 1) return "завтра";
  return `через ${daysUntil} ${pluralDays(daysUntil)}`;
}

export function BirthdaysPage() {
  const { data: entries = [], isLoading } = useQuery({ queryKey: ["birthdays"], queryFn: api.getBirthdays });
  const upcoming = entries.filter((e) => e.daysUntil <= SOON_WITHIN_DAYS);

  return (
    <div className="birthdays-page">
      <section className="upcoming-events">
        <h2 className="upcoming-events__title">Дни рождения в ближайшие {SOON_WITHIN_DAYS} дней</h2>
        {!isLoading && upcoming.length === 0 && (
          <p className="subjects-page__empty">В ближайшие {SOON_WITHIN_DAYS} дней дней рождения нет.</p>
        )}
        {upcoming.length > 0 && (
          <ul className="upcoming-events__list">
            {upcoming.map((e: BirthdayEntry) => (
              <li key={e.id} className="upcoming-events__item">
                <span className="upcoming-events__date">{formatDayMonth(e.birthDate)}</span>
                <span className="upcoming-events__subject">{e.name}</span>
                <span className="upcoming-events__badge">{formatCountdown(e.daysUntil)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="user-table-wrap">
        <table className="user-table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Дата рождения</th>
              <th>До дня рождения</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={3}>Загрузка…</td>
              </tr>
            )}
            {!isLoading && entries.length === 0 && (
              <tr>
                <td colSpan={3}>Дни рождения ещё никому не указаны — попросите админа заполнить их в управлении пользователями.</td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className={e.daysUntil <= SOON_WITHIN_DAYS ? "birthdays-page__row--soon" : ""}>
                <td>{e.name}</td>
                <td>{formatDayMonth(e.birthDate)}</td>
                <td>{formatCountdown(e.daysUntil)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
