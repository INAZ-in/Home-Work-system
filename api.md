# HomeWorke API

Express-бэкенд на `backend/src`, весь API живёт под префиксом `/api`. Хранилище — Postgres, миграции в `backend/src/db/migrations`. Ниже — как всё это устроено и как этим пользоваться.

## Аутентификация

- Схема — Bearer JWT. Токен выдаётся при `/api/auth/register` и `/api/auth/login`, живёт 30 дней (`backend/src/services/auth.ts`), подписывается `JWT_SECRET` из `.env`.
- Все запросы (кроме `/api/health`, `/api/auth/register`, `/api/auth/login`) требуют заголовок:
  ```
  Authorization: Bearer <token>
  ```
- Middleware `currentUser` (`backend/src/middleware/currentUser.ts`) проверяет токен, подтягивает пользователя из БД и кладёт его в `req.user`:
  ```ts
  interface CurrentUser {
    id: number;
    name: string;
    isAdmin: boolean;
    languageGroup: "en_strong" | "en_weak" | "de" | "es" | null;
    geometryGroup: 1 | 2 | null;
    canCreatePlans: boolean;
  }
  ```
- Отсутствующий/просроченный токен → `401`. Не-админ на админском роуте → `403` (middleware `requireAdmin`).
- Ошибки всегда в виде `{ "error": "текст" }` или, для промахов валидации (zod), `{ "error": { "fieldErrors": {...}, "formErrors": [...] } }`.

## Монтирование роутов (`backend/src/app.ts`)

| Префикс | Роутер | Кто может ходить |
|---|---|---|
| `/api/auth` | `routes/auth.ts` | `register`/`login` — публично; всё остальное через `currentUser` |
| `/api/users` | `routes/users.ts` | любой авторизованный |
| `/api` | `routes/schedule.ts`, `routes/homework.ts` | любой авторизованный |
| `/api/plans` | `routes/plans.ts` | любой авторизованный + свой флаг `canCreatePlans` |
| `/api/semesters` | `routes/semesters.ts` | `GET /active` — любой авторизованный; всё остальное — админ |
| `/api/admin` | `routes/admin.ts` | только админ (`requireAdmin` на весь роутер) |

## Ключевая идея: подгруппы

Группа делится на параллельные потоки по двум предметам — иностранный язык (сильный/слабый англ., немецкий, испанский) и начертательная геометрия (группа 1/2). BMSTU-синхронизация отдаёт на такой слот **один** `lesson_templates`, хотя по факту это разные занятия — поэтому у `homework_items` есть колонка `subgroup`, и логика в `backend/src/services/subgroup.ts` решает, какой "срез" дз показывать/писать конкретному пользователю:

- `subgroupKey(subjectName, lessonType, user)` — вычисляет ключ (`""` — общий, `lang_de`, `geo_1` и т.п.). Лекции всегда общие (`""`), даже у "разделяемых" предметов — делится только семинар/лаба.
- Если у пользователя не заполнены `languageGroup`/`geometryGroup`, он попадает в общий (`""`) срез.
- Эта функция используется и при чтении расписания (`resolveSchedule`), и при любой записи дз/файлов — так что пользователь физически не может напрямую попасть в чужую подгруппу: сервер сам определяет срез по профилю запрашивающего.
- `subgroupLabel(...)` — короткая подпись для фронта ("немецкий", "группа 2"), чтобы было видно, чьё именно дз показано.

## `/api/auth`

| Метод | Путь | Тело | Описание |
|---|---|---|---|
| POST | `/register` | `{ name, password, languageGroup, geometryGroup }` | Регистрация. Первый созданный пользователь в системе становится админом автоматически. `languageGroup`/`geometryGroup` обязательны. Имя уникально (без учёта регистра) → `409` при конфликте. Возвращает `{ token, user }`. |
| POST | `/login` | `{ name, password }` | Возвращает `{ token, user }`. Неверные креды → `401` (таймингово одинаково для несуществующего имени и неверного пароля). |
| GET | `/me` | — | Текущий `CurrentUser` из токена. |
| PUT | `/me/subgroups` | `{ languageGroup, geometryGroup }` | Пользователь сам меняет свои ответы на вопросы о подгруппах (те же, что при регистрации). |

## `/api/users`

| Метод | Путь | Описание |
|---|---|---|
| GET | `/` | Список всех пользователей группы: `{ id, name, isAdmin }[]`. |

## `/api/subjects`, `/api/schedule`

| Метод | Путь | Query | Описание |
|---|---|---|---|
| GET | `/subjects` | — | Список уникальных названий предметов активного семестра (для стабильной раскраски на фронте). |
| GET | `/schedule` | `from`, `to` (YYYY-MM-DD) | Расписание за диапазон дат, с дз/файлами/статусом "выполнено" **для текущего пользователя**, уже учитывающее подгруппу. |

Форма одного элемента расписания (`ScheduleOccurrence`):

```ts
{
  date: string;
  lessonTemplateId: number;
  pair: { num: number; start: string; end: string };
  subject: string;
  type: "lecture" | "seminar" | "lab" | "generated" | "";
  teacher: string;
  room: string;
  homework: {
    id: number;
    comment: string;
    dueDate: string | null;
    updatedAt: string;
    updatedBy: string | null;
    files: HomeworkFileMeta[];
  } | null;
  done: boolean;               // отметка "выполнено" текущего пользователя
  subgroupLabel: string | null; // "немецкий" / "группа 2" / null
}
```

## `/api/occurrences/:templateId/:date/...` — дз на конкретное занятие

`templateId` — id строки `lesson_templates` (приходит в каждом элементе расписания), `date` — дата конкретного проведения этого занятия.

| Метод | Путь | Тело | Описание |
|---|---|---|---|
| GET | `/occurrences/:templateId/next?after=YYYY-MM-DD` | — | Следующее занятие того же предмета **и типа** (лекция/семинар/лаба) после даты `after` — не обязательно тот же слот в расписании. Нужно для кнопки "дз на след. занятие →". |
| PUT | `/occurrences/:templateId/:date/comment` | `{ comment, dueDate? }` | Записать/изменить текст дз (для своей подгруппы). Создаёт `homework_items`, если его ещё нет. |
| PUT | `/occurrences/:templateId/:date/done` | `{ done: boolean }` | Отметить дз выполненным/невыполненным **для себя** (`homework_completions`, у каждого пользователя своя отметка). |
| DELETE | `/occurrences/:templateId/:date` | — | **Только админ.** Полностью удаляет запись дз (текст + отметки "выполнено" у всех + все прикреплённые файлы, каскадом). |
| POST | `/occurrences/:templateId/:date/files` | `multipart/form-data`, поле `file` | Прикрепить файл к дз (для своей подгруппы). Лимит — 15 МБ, иначе `400`. |

## `/api/homework-files/:id` — файлы дз

Файлы хранятся как `bytea` прямо в Postgres (без отдельного volume) — таблица `homework_files`.

| Метод | Путь | Описание |
|---|---|---|
| GET | `/homework-files/:id` | Скачать файл (`Content-Disposition: attachment`). |
| DELETE | `/homework-files/:id` | Удалить файл. |

Авторизация файлов: сервер проверяет, что `subgroup` записи дз, к которой привязан файл, совпадает с тем, что вычислился бы для текущего пользователя (`subgroupKey`) — либо пользователь админ. Промах → `404` (не `403`), чтобы угадывание id не подтверждало существование чужого файла.

## `/api/subjects/:name/homework` — вкладка «Предметы»

| Метод | Путь | Описание |
|---|---|---|
| GET | `/subjects/:name/homework` | Всё дз, когда-либо заведённое по этому предмету в активном семестре (любые даты, прошлые и будущие), с файлами и отметкой "выполнено" — уже отфильтровано по подгруппе пользователя. |

Элемент ответа (`SubjectHomeworkEntry`): `{ homeworkId, lessonTemplateId, occurrenceDate, type, teacher, room, comment, dueDate, updatedAt, updatedBy, done, files }`.

## `/api/plans` — личные планы

Приватные заметки/задачи, привязанные к дате. Доступны только тем, кому админ включил флаг `canCreatePlans` — весь роутер закрыт своим middleware (`403`, если флаг выключен). Каждый запрос жёстко скопирован на `req.user.id`: нет ни одного пути, включая админский API, который отдал бы текст чужого плана.

| Метод | Путь | Тело / Query | Описание |
|---|---|---|---|
| GET | `/plans?from=&to=` | — | Список своих планов в диапазоне дат. |
| POST | `/plans` | `{ date, text }` | Создать план. |
| PUT | `/plans/:id` | `{ text?, done?, date? }` | Частично обновить свой план (поля опциональны). Чужой/несуществующий id → `404`. |
| DELETE | `/plans/:id` | — | Удалить свой план (по чужому id — тихо ничего не делает). |

## `/api/semesters` — только админ (кроме `/active`)

| Метод | Путь | Тело | Описание |
|---|---|---|---|
| GET | `/` | — | Все семестры. |
| GET | `/active` | — | Активный семестр (или `null`) — открыт любому авторизованному, нужен фронту для меток числитель/знаменатель. |
| POST | `/` | `{ name, startDate, startWeekParity, bmstuGroupUuid? }` | Новый семестр. `startDate` обязана быть понедельником. |
| PUT | `/:id/bmstu-group` | `{ bmstuGroupUuid }` | Назначить/поменять группу ЛКС у существующего семестра — без этого синхронизация (`/api/admin/sync-now` и ночной cron) не работает и отвечает ошибкой `"Active semester has no bmstu_group_uuid configured"`. |
| PUT | `/:id/activate` | — | Сделать семестр активным (снимает активность с предыдущего). |

## `/api/admin` — только админ

Синхронизация с ЛКС (`backend/src/services/bmstuSync.ts`):

| Метод | Путь | Описание |
|---|---|---|
| GET | `/sync-runs?limit=` | Журнал последних запусков синхронизации (по умолчанию 20, максимум 100). |
| POST | `/sync-now` | Запустить синхронизацию активного семестра с ЛКС прямо сейчас. Помимо этого крутится по крону каждый день в 03:00 (Europe/Moscow), см. `backend/src/index.ts`. |
| GET | `/bmstu-groups?query=` | Поиск группы в дереве факультетов ЛКС по подстроке имени (напр. `ИУ8-13`) — публичный live-эндпоинт lks.bmstu.ru, без авторизации перед ним. |

Управление пользователями:

| Метод | Путь | Тело | Описание |
|---|---|---|---|
| GET | `/users` | — | Полный список с `createdAt`, подгруппами, `canCreatePlans`. |
| POST | `/users` | `{ name, password, isAdmin? }` | Создать пользователя от имени админа. |
| PUT | `/users/:id/admin` | `{ isAdmin }` | Выдать/забрать права админа. Нельзя разжаловать последнего админа. |
| PUT | `/users/:id/password` | `{ password }` | Сменить пароль любому пользователю. |
| PUT | `/users/:id/subgroups` | `{ languageGroup, geometryGroup }` | Поменять чужие ответы про подгруппы. |
| PUT | `/users/:id/can-create-plans` | `{ canCreatePlans }` | Разрешить/запретить личные планы. Текст существующих планов админу всё равно не виден. |
| DELETE | `/users/:id` | — | Удалить пользователя. Нельзя удалить последнего админа. Дз, которое он писал/редактировал, остаётся — просто теряет авторство (`created_by`/`updated_by` → `NULL`). |

## Прочее

- `GET /api/health` — без авторизации, `{ ok: true }`.
- Все ответы — JSON, кроме скачивания файла (`GET /homework-files/:id`).
- Формат дат везде `YYYY-MM-DD`, времени в `pair` — `HH:MM`.
