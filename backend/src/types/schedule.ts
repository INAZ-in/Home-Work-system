export interface PairInfo {
  num: number;
  start: string;
  end: string;
}

export interface HomeworkFileMeta {
  id: number;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string | null;
}

export type HomeworkKind = "regular" | "modular";

export type LessonEventType = "rk" | "kr" | "module_end" | "rabotka";

export interface OccurrenceHomework {
  id: number;
  comment: string;
  dueDate: string | null;
  updatedAt: string;
  updatedBy: string | null;
  files: HomeworkFileMeta[];
  kind: HomeworkKind;
}

export interface SubjectHomeworkEntry {
  homeworkId: number;
  lessonTemplateId: number;
  occurrenceDate: string;
  type: string;
  teacher: string;
  room: string;
  comment: string;
  dueDate: string | null;
  updatedAt: string;
  updatedBy: string | null;
  done: boolean;
  files: HomeworkFileMeta[];
  kind: HomeworkKind;
  /** Which elective subgroup this entry belongs to, e.g. "немецкий" or "группа 2" — null for subjects the whole group shares. Lets the frontend know when a "group admin" (their own subgroup only) may delete it. */
  subgroupLabel: string | null;
}

export interface UpcomingEvent {
  lessonTemplateId: number;
  date: string;
  eventType: LessonEventType;
  subject: string;
  type: string;
  teacher: string;
  room: string;
}

export interface PersonalPlan {
  id: number;
  date: string;
  text: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleOccurrence {
  date: string;
  lessonTemplateId: number;
  /** The occurrence's actual time — reflects a per-lesson override (see migration 010) when one applies. What to display on the card. */
  pair: PairInfo;
  /** This pair number's usual time from the shared `pairs` table, regardless of whether *this* occurrence has its own override — same value for every occurrence sharing a pair number. Lets the week view judge how far an override deviates from the norm before giving it its own row (see WeekTimeGrid.tsx). */
  nominalPair: PairInfo;
  subject: string;
  type: string;
  teacher: string;
  room: string;
  homework: OccurrenceHomework | null;
  done: boolean;
  /** Which elective subgroup's homework this is, e.g. "немецкий" or "группа 2" — null for subjects the whole group shares, or when the viewer hasn't answered the matching profile question yet. */
  subgroupLabel: string | null;
  /** Admin-set marker for this specific occurrence (РК/КР/Конец модуля/Работка) — null when none is set. */
  event: LessonEventType | null;
}
