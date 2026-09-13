import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useUser } from "../context/UserContext";
import { setSubjectOrder } from "../utils/subjectColor";

/**
 * Loads the active semester's distinct subject list once and primes the
 * subjectColor() lookup so colors stay stable and collision-free across the
 * whole app. Mount this once near the root (see App.tsx) — components keep
 * calling subjectColor(name) directly, no prop drilling needed.
 *
 * Sets the order synchronously during render, not in a useEffect: an effect
 * runs one tick after commit, by which point child components (LessonCard,
 * MonthDayCell, …) already rendered once with the hash-based fallback color
 * and nothing forces them to re-render afterwards — so the fix would only
 * "stick" whenever something else happened to force a later re-render (e.g.
 * navigating), and revert to colliding hash colors on every fresh page load.
 */
export function useSubjectColors(): void {
  const { currentUser } = useUser();
  const { data } = useQuery({
    queryKey: ["subjects"],
    queryFn: api.getSubjects,
    staleTime: 10 * 60 * 1000,
    enabled: Boolean(currentUser),
  });

  if (data) setSubjectOrder(data);
}
