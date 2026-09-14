import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { api } from "../api/client";
import { useUser } from "../context/UserContext";
import {
  GEOMETRY_GROUP_LABELS,
  LANGUAGE_GROUP_LABELS,
  type GeometryGroup,
  type LanguageGroup,
} from "../types/schedule";

export function SettingsPage() {
  const { currentUser, login } = useUser();
  const [languageGroup, setLanguageGroup] = useState<LanguageGroup | "">(currentUser?.languageGroup ?? "");
  const [geometryGroup, setGeometryGroup] = useState<GeometryGroup | "">(currentUser?.geometryGroup ?? "");

  const mutation = useMutation({
    mutationFn: () => api.updateMySubgroups(languageGroup as LanguageGroup, geometryGroup as GeometryGroup),
    onSuccess: (user) => {
      const token = localStorage.getItem("homework.token") ?? "";
      login({ token, user });
    },
  });

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (languageGroup && geometryGroup) mutation.mutate();
  };

  return (
    <div className="admin-page">
      <section className="admin-section">
        <h2>Настройки</h2>
        <p>
          Эти ответы определяют, какое дз по иностранному языку и начертательной геометрии показывается вам в
          расписании — у каждой подгруппы оно своё.
        </p>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>
            Группа по иностранному языку
            <select value={languageGroup} onChange={(e) => setLanguageGroup(e.target.value as LanguageGroup)} required>
              <option value="" disabled>
                Выберите группу
              </option>
              {Object.entries(LANGUAGE_GROUP_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Группа по начертательной геометрии
            <select
              value={geometryGroup}
              onChange={(e) => setGeometryGroup(Number(e.target.value) as GeometryGroup)}
              required
            >
              <option value="" disabled>
                Выберите группу
              </option>
              {Object.entries(GEOMETRY_GROUP_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {mutation.isError && <p className="form-error">{(mutation.error as Error).message}</p>}
          {mutation.isSuccess && <p className="admin-form__hint">Сохранено.</p>}
          <button type="submit" disabled={mutation.isPending}>
            Сохранить
          </button>
        </form>
      </section>
    </div>
  );
}
