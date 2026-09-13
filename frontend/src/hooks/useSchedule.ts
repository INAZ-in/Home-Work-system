import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export function useSchedule(from: string, to: string) {
  return useQuery({
    queryKey: ["schedule", from, to],
    queryFn: () => api.getSchedule(from, to),
  });
}
