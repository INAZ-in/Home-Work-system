export type LanguageGroup = "en_strong" | "en_weak" | "de" | "es";
export type GeometryGroup = 1 | 2;

export const LANGUAGE_GROUPS: readonly LanguageGroup[] = ["en_strong", "en_weak", "de", "es"];
export const GEOMETRY_GROUPS: readonly GeometryGroup[] = [1, 2];

export interface UserSubgroups {
  languageGroup: LanguageGroup | null;
  geometryGroup: GeometryGroup | null;
}

function isForeignLanguage(subjectName: string): boolean {
  return subjectName.toLowerCase().includes("иностран");
}

function isDescriptiveGeometry(subjectName: string): boolean {
  return subjectName.toLowerCase().includes("начертательн");
}

/**
 * A lecture for a split subject is still one shared session for the whole
 * group (e.g. "Начертательная геометрия" lecture, room 220л) — only the
 * practical sessions (seminar/lab) actually run as separate parallel groups
 * (different rooms/teachers for the same slot). Splitting the lecture's
 * homework too would hide it from students in the "other" practical group
 * who sat through the very same lecture.
 */
function isSplitLessonType(lessonType: string): boolean {
  return lessonType !== "lecture";
}

/**
 * Which homework "slice" a user sees/edits for a lesson with this subject
 * name and type. The BMSTU sync produces one shared `lesson_templates` row
 * per slot even when the group splits into parallel practical sessions
 * (different foreign language tracks, different descriptive-geometry
 * groups) — this is what lets `homework_items` (see migration 005) keep
 * those sessions' homework separate despite sharing a `lesson_template_id`.
 *
 * Returns "" (the shared bucket) for every non-split subject or session
 * type, and also for a split subject when the user hasn't answered the
 * matching profile question yet — better to fall back to the shared item
 * than to crash or silently drop their homework.
 */
export function subgroupKey(subjectName: string, lessonType: string, user: UserSubgroups): string {
  if (!isSplitLessonType(lessonType)) return "";
  if (isForeignLanguage(subjectName)) {
    return user.languageGroup ? `lang_${user.languageGroup}` : "";
  }
  if (isDescriptiveGeometry(subjectName)) {
    return user.geometryGroup ? `geo_${user.geometryGroup}` : "";
  }
  return "";
}

const LANGUAGE_SHORT_LABELS: Record<LanguageGroup, string> = {
  en_strong: "англ., сильная",
  en_weak: "англ., слабая",
  de: "немецкий",
  es: "испанский",
};

/** Short label to show next to a split session so it's clear whose homework is displayed, or null when the session isn't split (or the user hasn't answered the matching profile question yet). */
export function subgroupLabel(subjectName: string, lessonType: string, user: UserSubgroups): string | null {
  if (!isSplitLessonType(lessonType)) return null;
  if (isForeignLanguage(subjectName)) {
    return user.languageGroup ? LANGUAGE_SHORT_LABELS[user.languageGroup] : null;
  }
  if (isDescriptiveGeometry(subjectName)) {
    return user.geometryGroup ? `группа ${user.geometryGroup}` : null;
  }
  return null;
}
