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
  type: string;
  teacher: string;
  room: string;
  comment: string;
  dueDate: string | null;
  updatedAt: string;
  updatedBy: string | null;
  done: boolean;
  files: HomeworkFileMeta[];
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
  pair: PairInfo;
  subject: string;
  type: string;
  teacher: string;
  room: string;
  homework: OccurrenceHomework | null;
  done: boolean;
  /** Which elective subgroup's homework this is, e.g. "немецкий" or "группа 2" — null for subjects the whole group shares, or when the viewer hasn't answered the matching profile question yet. */
  subgroupLabel: string | null;
}
