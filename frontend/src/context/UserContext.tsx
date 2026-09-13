import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setAuthToken, setUnauthorizedHandler, type AuthResponse } from "../api/client";
import type { User } from "../types/schedule";

const TOKEN_KEY = "homeworke.token";
const USER_KEY = "homeworke.user";

interface UserContextValue {
  currentUser: User | null;
  /** True while the stored token is being validated against the server on first load. */
  isRestoring: boolean;
  login: (auth: AuthResponse) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

function loadStored(): { token: string; user: User } | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    if (!token || !rawUser) return null;
    return { token, user: JSON.parse(rawUser) as User };
  } catch {
    return null;
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  // Set synchronously (not in an effect) so the very first API call fired by
  // a child's useQuery already carries the Authorization header.
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = loadStored();
    setAuthToken(stored?.token ?? null);
    return stored?.user ?? null;
  });
  const [isRestoring, setIsRestoring] = useState(() => loadStored() !== null);

  const login = (auth: AuthResponse): void => {
    localStorage.setItem(TOKEN_KEY, auth.token);
    localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
    setAuthToken(auth.token);
    setCurrentUser(auth.user);
  };

  const logout = (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuthToken(null);
    setCurrentUser(null);
  };

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validate the stored token once on mount — a stale/expired/revoked token
  // shouldn't silently pretend the user is still logged in.
  useEffect(() => {
    const stored = loadStored();
    if (!stored) return;
    api
      .me()
      .catch(() => logout())
      .finally(() => setIsRestoring(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<UserContextValue>(
    () => ({ currentUser, isRestoring, login, logout }),
    [currentUser, isRestoring],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
