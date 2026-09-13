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

export interface OccurrenceHomework {
  id: number;
  comment: string;
  dueDate: string | null;
  updatedAt: string;
  updatedBy: string | null;
  files: HomeworkFileMeta[];
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
}

export interface ScheduleOccurrence {
  date: string;
  lessonTemplateId: number;
  pair: PairInfo;
  subject: string;
  type: "lecture" | "seminar" | "lab" | "generated" | "";
  teacher: string;
  room: string;
  homework: OccurrenceHomework | null;
  done: boolean;
  subgroupLabel: string | null;
}

export type LanguageGroup = "en_strong" | "en_weak" | "de" | "es";
export type GeometryGroup = 1 | 2;

export const LANGUAGE_GROUP_LABELS: Record<LanguageGroup, string> = {
  en_strong: "Английский (сильная группа)",
  en_weak: "Английский (слабая группа)",
  de: "Немецкий",
  es: "Испанский",
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
