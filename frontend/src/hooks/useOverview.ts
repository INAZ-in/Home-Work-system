import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export function useOverview(from: string, to: string) {
  return useQuery({
    queryKey: ["overview", from, to],
    queryFn: () => api.getOverview(from, to),
  });
}
