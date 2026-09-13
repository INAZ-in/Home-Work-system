import { useState } from "react";
import { useUser } from "./context/UserContext";
import { useSubjectColors } from "./hooks/useSubjectColors";
import { AdminPage } from "./pages/AdminPage";
import { LoginPage } from "./pages/LoginPage";
import { SchedulePage } from "./pages/SchedulePage";
import { SettingsPage } from "./pages/SettingsPage";

type Page = "schedule" | "admin" | "settings";

export function App() {
  const { currentUser, isRestoring, logout } = useUser();
  const [page, setPage] = useState<Page>("schedule");
  useSubjectColors();

  if (isRestoring) return <div className="app-loading">Загрузка…</div>;
  if (!currentUser) return <LoginPage />;

  const profileIncomplete = !currentUser.languageGroup || !currentUser.geometryGroup;
  const showAdmin = page === "admin" && currentUser.isAdmin;
  const showSettings = page === "settings" || profileIncomplete;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand">HomeWorke</div>
        <nav className="app-header__nav">
          <button type="button" className={page === "schedule" ? "active" : ""} onClick={() => setPage("schedule")}>
            Расписание
          </button>
          <button type="button" className={page === "settings" ? "active" : ""} onClick={() => setPage("settings")}>
            Настройки
          </button>
          {currentUser.isAdmin && (
            <button type="button" className={page === "admin" ? "active" : ""} onClick={() => setPage("admin")}>
              Админ
            </button>
          )}
        </nav>
        <div className="app-header__user">
          <span>
            {currentUser.name}
            {currentUser.isAdmin && <span className="app-header__admin-badge">админ</span>}
          </span>
          <button type="button" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>
      {profileIncomplete && (
        <p className="app-profile-banner">
          Заполните группы по языку и геометрии в настройках — от этого зависит, какое дз показывается в расписании.
        </p>
      )}
      <main className="app-main">{showSettings ? <SettingsPage /> : showAdmin ? <AdminPage /> : <SchedulePage />}</main>
    </div>
  );
}
