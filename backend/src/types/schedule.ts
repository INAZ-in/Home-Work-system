export interface PairInfo {
  num: number;
  start: string;
  end: string;
}

export interface OccurrenceHomework {
  id: number;
  comment: string;
  dueDate: string | null;
  updatedAt: string;
  updatedBy: string | null;
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
