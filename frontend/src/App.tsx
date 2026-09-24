import { useState } from "react";
import { useUser } from "./context/UserContext";
import { useSubjectColors } from "./hooks/useSubjectColors";
import { AdminPage } from "./pages/AdminPage";
import { BirthdaysPage } from "./pages/BirthdaysPage";
import { LoginPage } from "./pages/LoginPage";
import { PlansPage } from "./pages/PlansPage";
import { SchedulePage } from "./pages/SchedulePage";
import { SettingsPage } from "./pages/SettingsPage";
import { SubjectsPage } from "./pages/SubjectsPage";

type Page = "schedule" | "subjects" | "birthdays" | "plans" | "admin" | "settings";

export function App() {
  const { currentUser, isRestoring, logout } = useUser();
  const [page, setPage] = useState<Page>("schedule");
  useSubjectColors();

  if (isRestoring) return <div className="app-loading">Загрузка…</div>;
  if (!currentUser) return <LoginPage />;

  const profileIncomplete = !currentUser.languageGroup || !currentUser.geometryGroup;
  const showAdmin = page === "admin" && currentUser.isAdmin;
  const showSettings = page === "settings" || profileIncomplete;
  const showSubjects = page === "subjects" && !showSettings;
  const showBirthdays = page === "birthdays" && !showSettings;
  const showPlans = page === "plans" && currentUser.canCreatePlans && !showSettings;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand">Homework</div>
        <nav className="app-header__nav">
          <button type="button" className={page === "schedule" ? "active" : ""} onClick={() => setPage("schedule")}>
            Расписание
          </button>
          <button type="button" className={page === "subjects" ? "active" : ""} onClick={() => setPage("subjects")}>
            Предметы
          </button>
          <button type="button" className={page === "birthdays" ? "active" : ""} onClick={() => setPage("birthdays")}>
            Дни рождения
          </button>
          {currentUser.canCreatePlans && (
            <button type="button" className={page === "plans" ? "active" : ""} onClick={() => setPage("plans")}>
              Мои планы
            </button>
          )}
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
      <main className="app-main">
        {showSettings ? (
          <SettingsPage />
        ) : showAdmin ? (
          <AdminPage />
        ) : showSubjects ? (
          <SubjectsPage />
        ) : showBirthdays ? (
          <BirthdaysPage />
        ) : showPlans ? (
          <PlansPage />
        ) : (
          <SchedulePage />
        )}
      </main>
    </div>
  );
}
