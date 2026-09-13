import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export function usePlans(from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: ["plans", from, to],
    queryFn: () => api.getPlans(from, to),
    enabled,
  });
}
