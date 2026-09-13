import type {
  AdminUser,
  BmstuGroupMatch,
  GeometryGroup,
  LanguageGroup,
  ScheduleOccurrence,
  Semester,
  SyncRun,
  User,
} from "../types/schedule";

const API_BASE = import.meta.env.VITE_API_URL || "";

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** Called whenever a request comes back 401 (expired/invalid/missing token) — wires up auto-logout. */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (authToken !== null) headers.set("Authorization", `Bearer ${authToken}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) {
        message = typeof body.error === "string" ? body.error : JSON.stringify(body.error);
      }
    } catch {
      // response had no JSON body — keep the status-based message
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const api = {
  register: (
    name: string,
    password: string,
    languageGroup: LanguageGroup,
    geometryGroup: GeometryGroup,
  ) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, password, languageGroup, geometryGroup }),
    }),
  login: (name: string, password: string) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ name, password }) }),
  me: () => request<User>("/api/auth/me"),
  updateMySubgroups: (languageGroup: LanguageGroup, geometryGroup: GeometryGroup) =>
    request<User>("/api/auth/me/subgroups", {
      method: "PUT",
      body: JSON.stringify({ languageGroup, geometryGroup }),
    }),

  getUsers: () => request<User[]>("/api/users"),
  getSubjects: () => request<string[]>("/api/subjects"),

  getSchedule: (from: string, to: string) => request<ScheduleOccurrence[]>(`/api/schedule?from=${from}&to=${to}`),

  getNextOccurrence: (templateId: number, after: string) =>
    request<ScheduleOccurrence>(`/api/occurrences/${templateId}/next?after=${after}`),

  updateComment: (templateId: number, date: string, comment: string, dueDate: string | null) =>
    request(`/api/occurrences/${templateId}/${date}/comment`, {
      method: "PUT",
      body: JSON.stringify({ comment, dueDate }),
    }),

  updateDone: (templateId: number, date: string, done: boolean) =>
    request(`/api/occurrences/${templateId}/${date}/done`, {
      method: "PUT",
      body: JSON.stringify({ done }),
    }),

  deleteHomework: (templateId: number, date: string) =>
    request<void>(`/api/occurrences/${templateId}/${date}`, { method: "DELETE" }),

  getSemesters: () => request<Semester[]>("/api/semesters"),
  getActiveSemester: () => request<Semester | null>("/api/semesters/active"),
  createSemester: (data: { name: string; startDate: string; startWeekParity: "ch" | "zn"; bmstuGroupUuid?: string }) =>
    request<Semester>("/api/semesters", { method: "POST", body: JSON.stringify(data) }),
  activateSemester: (id: number) => request(`/api/semesters/${id}/activate`, { method: "PUT" }),

  getSyncRuns: () => request<SyncRun[]>("/api/admin/sync-runs"),
  syncNow: () => request<{ status: string }>("/api/admin/sync-now", { method: "POST" }),
  findBmstuGroups: (query: string) =>
    request<BmstuGroupMatch[]>(`/api/admin/bmstu-groups?query=${encodeURIComponent(query)}`),

  getAdminUsers: () => request<AdminUser[]>("/api/admin/users"),
  createUserAsAdmin: (name: string, password: string, isAdmin: boolean) =>
    request<AdminUser>("/api/admin/users", { method: "POST", body: JSON.stringify({ name, password, isAdmin }) }),
  setUserAdmin: (userId: number, isAdmin: boolean) =>
    request<AdminUser>(`/api/admin/users/${userId}/admin`, { method: "PUT", body: JSON.stringify({ isAdmin }) }),
  setUserPassword: (userId: number, password: string) =>
    request<AdminUser>(`/api/admin/users/${userId}/password`, { method: "PUT", body: JSON.stringify({ password }) }),
  setUserSubgroups: (userId: number, languageGroup: LanguageGroup, geometryGroup: GeometryGroup) =>
    request<AdminUser>(`/api/admin/users/${userId}/subgroups`, {
      method: "PUT",
      body: JSON.stringify({ languageGroup, geometryGroup }),
    }),
  deleteUser: (userId: number) => request<void>(`/api/admin/users/${userId}`, { method: "DELETE" }),
};
