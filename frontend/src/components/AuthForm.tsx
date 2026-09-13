import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { api, type AuthResponse } from "../api/client";
import {
  GEOMETRY_GROUP_LABELS,
  LANGUAGE_GROUP_LABELS,
  type GeometryGroup,
  type LanguageGroup,
} from "../types/schedule";

interface Props {
  onSuccess: (auth: AuthResponse) => void;
}

type Mode = "login" | "register";

export function AuthForm({ onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [languageGroup, setLanguageGroup] = useState<LanguageGroup | "">("");
  const [geometryGroup, setGeometryGroup] = useState<GeometryGroup | "">("");

  const mutation = useMutation({
    mutationFn: () =>
      mode === "login"
        ? api.login(name, password)
        : api.register(name, password, languageGroup as LanguageGroup, geometryGroup as GeometryGroup),
    onSuccess,
  });

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const trimmed = name.trim();
    if (mode === "register" && (!languageGroup || !geometryGroup)) return;
    if (trimmed && password) mutation.mutate();
  };

  const switchMode = (next: Mode): void => {
    setMode(next);
    mutation.reset();
  };

  return (
    <div className="auth-form">
      <div className="auth-form__tabs">
        <button
          type="button"
          className={mode === "login" ? "active" : ""}
          onClick={() => switchMode("login")}
        >
          Войти
        </button>
        <button
          type="button"
          className={mode === "register" ? "active" : ""}
          onClick={() => switchMode("register")}
        >
          Регистрация
        </button>
      </div>
      <form className="auth-form__fields" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={6}
          required
        />
        {mode === "register" && (
          <>
            <select
              value={languageGroup}
              onChange={(e) => setLanguageGroup(e.target.value as LanguageGroup)}
              required
            >
              <option value="" disabled>
                Группа по иностранному языку
              </option>
              {Object.entries(LANGUAGE_GROUP_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={geometryGroup}
              onChange={(e) => setGeometryGroup(Number(e.target.value) as GeometryGroup)}
              required
            >
              <option value="" disabled>
                Группа по начертательной геометрии
              </option>
              {Object.entries(GEOMETRY_GROUP_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </>
        )}
        <button type="submit" disabled={mutation.isPending}>
          {mode === "login" ? "Войти" : "Зарегистрироваться"}
        </button>
      </form>
      {mode === "register" && <p className="auth-form__hint">Пароль — минимум 6 символов.</p>}
      {mutation.isError && <p className="form-error">{(mutation.error as Error).message}</p>}
    </div>
  );
}
