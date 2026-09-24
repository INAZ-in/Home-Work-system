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

export const LESSON_EVENT_LABELS: Record<LessonEventType, string> = {
  rk: "РК",
  kr: "КР",
  module_end: "Конец модуля",
  rabotka: "Работка",
};

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
  type: "lecture" | "seminar" | "lab" | "generated" | "";
  teacher: string;
  room: string;
  comment: string;
  dueDate: string | null;
  updatedAt: string;
  updatedBy: string | null;
  done: boolean;
  files: HomeworkFileMeta[];
  kind: HomeworkKind;
  subgroupLabel: string | null;
}

export interface ScheduleOccurrence {
  date: string;
  lessonTemplateId: number;
  /** The occurrence's actual time — reflects a per-lesson override when one applies. What to display on the card. */
  pair: PairInfo;
  /** This pair number's usual time, same for every occurrence sharing a pair number regardless of any override on this specific one — used by the week view to judge how far an override deviates before giving it its own row. */
  nominalPair: PairInfo;
  subject: string;
  type: "lecture" | "seminar" | "lab" | "generated" | "";
  teacher: string;
  room: string;
  homework: OccurrenceHomework | null;
  done: boolean;
  subgroupLabel: string | null;
  event: LessonEventType | null;
}

export interface UpcomingEvent {
  lessonTemplateId: number;
  date: string;
  eventType: LessonEventType;
  subject: string;
  type: "lecture" | "seminar" | "lab" | "generated" | "";
  teacher: string;
  room: string;
}

export type LanguageGroup = "en_strong" | "en_weak" | "de" | "es" | "zh";
export type GeometryGroup = 1 | 2;

export const LANGUAGE_GROUP_LABELS: Record<LanguageGroup, string> = {
  en_strong: "Английский (сильная группа)",
  en_weak: "Английский (слабая группа)",
  de: "Немецкий",
  es: "Испанский",
  zh: "Китайский",
};

export const GEOMETRY_GROUP_LABELS: Record<GeometryGroup, string> = {
  1: "Начертательная геометрия — группа 1",
  2: "Начертательная геометрия — группа 2",
};

export interface User {
  id: number;
  name: string;
  isAdmin: boolean;
  languageGroup: LanguageGroup | null;
  geometryGroup: GeometryGroup | null;
  canCreatePlans: boolean;
  /** Junior-admin: may delete homework in their own foreign-language/descriptive-geometry subgroup only. */
  groupAdmin: boolean;
}

export interface PersonalPlan {
  id: number;
  date: string;
  text: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser extends User {
  createdAt: string;
  lastLoginAt: string | null;
  approved: boolean;
  birthDate: string | null;
}

export interface BirthdayEntry {
  id: number;
  name: string;
  birthDate: string;
  daysUntil: number;
}

export interface Semester {
  id: number;
  name: string;
  startDate: string;
  startWeekParity: "ch" | "zn";
  isActive: boolean;
  bmstuGroupUuid: string | null;
}

export interface SyncChange {
  type: "added" | "updated" | "deactivated";
  day: number;
  pair: number;
  parity: string;
  subject: string;
  field?: string;
  old?: string;
  new?: string;
}

export interface StorageUsage {
  usedBytes: number;
  totalBytes: number;
  fileCount: number;
}

export interface BmstuGroupMatch {
  name: string;
  uuid: string;
  path: string;
}

export interface SyncRun {
  id: number;
  semesterId: number;
  runAt: string;
  status: "ok" | "error";
  addedCount: number;
  updatedCount: number;
  deactivatedCount: number;
  details: SyncChange[];
  error: string | null;
}
