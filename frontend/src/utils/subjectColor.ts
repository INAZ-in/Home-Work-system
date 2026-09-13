// Same palette as bmstu_schedule.py's SUBJECT_PALETTE (IBM Carbon
// categorical) — reads well as an accent on both light and dark backgrounds.
const PALETTE = [
  "#6929c4",
  "#1192e8",
  "#005d5d",
  "#9f1853",
  "#fa4d56",
  "#570408",
  "#198038",
  "#002d9c",
  "#ee538b",
  "#b28600",
  "#009d9a",
  "#8a3800",
  "#a56eff",
  "#1c7c54",
];

// Populated from GET /api/subjects (see hooks/useSubjectColors.ts) so every
// distinct subject gets a distinct color, up to PALETTE.length — a pure hash
// assignment can't guarantee that (birthday-paradox collisions kick in well
// before the palette is exhausted).
let orderedColors: Map<string, string> = new Map();

export function setSubjectOrder(subjectNames: string[]): void {
  orderedColors = new Map(subjectNames.map((name, i) => [name, PALETTE[i % PALETTE.length]]));
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Falls back to a hash-based color for a subject not yet in the loaded order (e.g. before first load, or newly added by a live sync). */
export function subjectColor(name: string): string {
  return orderedColors.get(name) ?? hashColor(name);
}
