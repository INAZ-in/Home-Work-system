import type {
  AdminUser,
  BmstuGroupMatch,
  GeometryGroup,
  HomeworkFileMeta,
  LanguageGroup,
  PersonalPlan,
  ScheduleOccurrence,
  Semester,
  StorageUsage,
  SubjectHomeworkEntry,
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

/** Same auth/error handling as `request`, but for a raw fetch response (file upload/download) instead of always sending/expecting JSON. */
async function requestBinary(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
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
  return res;
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

  /** Schedule (with homework) + personal plans for a date range in one call. `includeFiles: false` omits homework.files for a lighter payload. */
  getOverview: (from: string, to: string, includeFiles = true) =>
    request<{ occurrences: ScheduleOccurrence[]; plans: PersonalPlan[] }>(
      `/api/overview?from=${from}&to=${to}&files=${includeFiles}`,
    ),

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

  uploadHomeworkFile: async (templateId: number, date: string, file: File): Promise<HomeworkFileMeta> => {
    const body = new FormData();
    body.append("file", file);
    const res = await requestBinary(`/api/occurrences/${templateId}/${date}/files`, { method: "POST", body });
    return (await res.json()) as HomeworkFileMeta;
  },
  deleteHomeworkFile: (fileId: number) => request<void>(`/api/homework-files/${fileId}`, { method: "DELETE" }),
  downloadHomeworkFile: async (fileId: number, filename: string): Promise<void> => {
    const res = await requestBinary(`/api/homework-files/${fileId}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  getSubjectHomework: (subject: string) =>
    request<SubjectHomeworkEntry[]>(`/api/subjects/${encodeURIComponent(subject)}/homework`),

  getPlans: (from: string, to: string) => request<PersonalPlan[]>(`/api/plans?from=${from}&to=${to}`),
  createPlan: (date: string, text: string) =>
    request<PersonalPlan>("/api/plans", { method: "POST", body: JSON.stringify({ date, text }) }),
  updatePlan: (id: number, data: { text?: string; done?: boolean; date?: string }) =>
    request<PersonalPlan>(`/api/plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePlan: (id: number) => request<void>(`/api/plans/${id}`, { method: "DELETE" }),

  getSemesters: () => request<Semester[]>("/api/semesters"),
  getActiveSemester: () => request<Semester | null>("/api/semesters/active"),
  createSemester: (data: { name: string; startDate: string; startWeekParity: "ch" | "zn"; bmstuGroupUuid?: string }) =>
    request<Semester>("/api/semesters", { method: "POST", body: JSON.stringify(data) }),
  activateSemester: (id: number) => request(`/api/semesters/${id}/activate`, { method: "PUT" }),
  setSemesterGroup: (id: number, bmstuGroupUuid: string) =>
    request<Semester>(`/api/semesters/${id}/bmstu-group`, { method: "PUT", body: JSON.stringify({ bmstuGroupUuid }) }),

  getSyncRuns: () => request<SyncRun[]>("/api/admin/sync-runs"),
  syncNow: () => request<{ status: string }>("/api/admin/sync-now", { method: "POST" }),
  findBmstuGroups: (query: string) =>
    request<BmstuGroupMatch[]>(`/api/admin/bmstu-groups?query=${encodeURIComponent(query)}`),
  getStorageUsage: () => request<StorageUsage>("/api/admin/storage-usage"),

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
  setUserCanCreatePlans: (userId: number, canCreatePlans: boolean) =>
    request<AdminUser>(`/api/admin/users/${userId}/can-create-plans`, {
      method: "PUT",
      body: JSON.stringify({ canCreatePlans }),
    }),
  deleteUser: (userId: number) => request<void>(`/api/admin/users/${userId}`, { method: "DELETE" }),
};
