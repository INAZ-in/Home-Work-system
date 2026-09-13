import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export function useActiveSemester() {
  return useQuery({
    queryKey: ["semester-active"],
    queryFn: api.getActiveSemester,
    staleTime: 10 * 60 * 1000,
  });
}
