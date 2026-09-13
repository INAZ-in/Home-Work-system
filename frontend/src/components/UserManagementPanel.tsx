import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, type FormEvent, useState } from "react";
import { api } from "../api/client";
import { useUser } from "../context/UserContext";
import {
  GEOMETRY_GROUP_LABELS,
  LANGUAGE_GROUP_LABELS,
  type GeometryGroup,
  type LanguageGroup,
} from "../types/schedule";
import { formatDayMonth } from "../utils/date";

export function UserManagementPanel() {
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  const { data: users = [], isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: api.getAdminUsers });

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);

  const [passwordEditId, setPasswordEditId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [subgroupsEditId, setSubgroupsEditId] = useState<number | null>(null);
  const [editLanguageGroup, setEditLanguageGroup] = useState<LanguageGroup | "">("");
  const [editGeometryGroup, setEditGeometryGroup] = useState<GeometryGroup | "">("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const createMutation = useMutation({
    mutationFn: () => api.createUserAsAdmin(name, password, makeAdmin),
    onSuccess: () => {
      setName("");
      setPassword("");
      setMakeAdmin(false);
      invalidate();
    },
  });

  const setAdminMutation = useMutation({
    mutationFn: ({ id, isAdmin }: { id: number; isAdmin: boolean }) => api.setUserAdmin(id, isAdmin),
    onSuccess: invalidate,
  });

  const setPasswordMutation = useMutation({
    mutationFn: ({ id, password: pw }: { id: number; password: string }) => api.setUserPassword(id, pw),
    onSuccess: () => {
      setPasswordEditId(null);
      setNewPassword("");
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteUser(id),
    onSuccess: invalidate,
  });

  const setSubgroupsMutation = useMutation({
    mutationFn: ({ id, languageGroup, geometryGroup }: { id: number; languageGroup: LanguageGroup; geometryGroup: GeometryGroup }) =>
      api.setUserSubgroups(id, languageGroup, geometryGroup),
    onSuccess: () => {
      setSubgroupsEditId(null);
      invalidate();
    },
  });

  const setCanCreatePlansMutation = useMutation({
    mutationFn: ({ id, canCreatePlans }: { id: number; canCreatePlans: boolean }) =>
      api.setUserCanCreatePlans(id, canCreatePlans),
    onSuccess: invalidate,
  });

  const handleCreate = (e: FormEvent): void => {
    e.preventDefault();
    if (name.trim() && password) createMutation.mutate();
  };

  const handleSavePassword = (e: FormEvent, id: number): void => {
    e.preventDefault();
    if (newPassword) setPasswordMutation.mutate({ id, password: newPassword });
  };

  const handleSaveSubgroups = (e: FormEvent, id: number): void => {
    e.preventDefault();
    if (editLanguageGroup && editGeometryGroup) {
      setSubgroupsMutation.mutate({ id, languageGroup: editLanguageGroup, geometryGroup: editGeometryGroup });
    }
  };

  const handleDelete = (id: number, userName: string): void => {
    if (window.confirm(`Удалить пользователя «${userName}»? Это необратимо.`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <>
      <div className="user-table-wrap">
        <table className="user-table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Зарегистрирован</th>
              <th>Роль</th>
              <th>Группы</th>
              <th>Личные планы</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6}>Загрузка…</td>
              </tr>
            )}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={6}>Пользователей пока нет.</td>
              </tr>
            )}
            {users.map((u) => (
              <Fragment key={u.id}>
                <tr>
                  <td>
                    {u.name}
                    {u.id === currentUser?.id && <span className="user-admin-list__you"> (вы)</span>}
                  </td>
                  <td>{formatDayMonth(u.createdAt.slice(0, 10))}</td>
                  <td>{u.isAdmin && <span className="app-header__admin-badge">админ</span>}</td>
                  <td>
                    {u.languageGroup ? LANGUAGE_GROUP_LABELS[u.languageGroup] : "—"}
                    <br />
                    {u.geometryGroup ? GEOMETRY_GROUP_LABELS[u.geometryGroup] : "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setCanCreatePlansMutation.mutate({ id: u.id, canCreatePlans: !u.canCreatePlans })}
                      disabled={setCanCreatePlansMutation.isPending}
                    >
                      {u.canCreatePlans ? "Разрешены" : "Запрещены"}
                    </button>
                  </td>
                  <td className="user-table__actions">
                    <button
                      type="button"
                      onClick={() => setAdminMutation.mutate({ id: u.id, isAdmin: !u.isAdmin })}
                      disabled={setAdminMutation.isPending}
                    >
                      {u.isAdmin ? "Убрать админа" : "Сделать админом"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordEditId(passwordEditId === u.id ? null : u.id);
                        setNewPassword("");
                      }}
                    >
                      Сменить пароль
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSubgroupsEditId(subgroupsEditId === u.id ? null : u.id);
                        setEditLanguageGroup(u.languageGroup ?? "");
                        setEditGeometryGroup(u.geometryGroup ?? "");
                      }}
                    >
                      Изменить группы
                    </button>
                    <button type="button" className="user-table__delete" onClick={() => handleDelete(u.id, u.name)}>
                      Удалить
                    </button>
                  </td>
                </tr>
                {passwordEditId === u.id && (
                  <tr>
                    <td colSpan={6}>
                      <form className="user-table__password-form" onSubmit={(e) => handleSavePassword(e, u.id)}>
                        <input
                          type="password"
                          placeholder="Новый пароль"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          minLength={6}
                          autoFocus
                          required
                        />
                        <button type="submit" disabled={setPasswordMutation.isPending}>
                          Сохранить
                        </button>
                        <button type="button" onClick={() => setPasswordEditId(null)}>
                          Отмена
                        </button>
                      </form>
                    </td>
                  </tr>
                )}
                {subgroupsEditId === u.id && (
                  <tr>
                    <td colSpan={6}>
                      <form className="user-table__password-form" onSubmit={(e) => handleSaveSubgroups(e, u.id)}>
                        <select
                          value={editLanguageGroup}
                          onChange={(e) => setEditLanguageGroup(e.target.value as LanguageGroup)}
                          required
                        >
                          <option value="" disabled>
                            Группа по языку
                          </option>
                          {Object.entries(LANGUAGE_GROUP_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editGeometryGroup}
                          onChange={(e) => setEditGeometryGroup(Number(e.target.value) as GeometryGroup)}
                          required
                        >
                          <option value="" disabled>
                            Группа по геометрии
                          </option>
                          {Object.entries(GEOMETRY_GROUP_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <button type="submit" disabled={setSubgroupsMutation.isPending}>
                          Сохранить
                        </button>
                        <button type="button" onClick={() => setSubgroupsEditId(null)}>
                          Отмена
                        </button>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {setAdminMutation.isError && <p className="form-error">{(setAdminMutation.error as Error).message}</p>}
      {setPasswordMutation.isError && <p className="form-error">{(setPasswordMutation.error as Error).message}</p>}
      {setSubgroupsMutation.isError && <p className="form-error">{(setSubgroupsMutation.error as Error).message}</p>}
      {setCanCreatePlansMutation.isError && (
        <p className="form-error">{(setCanCreatePlansMutation.error as Error).message}</p>
      )}
      {deleteMutation.isError && <p className="form-error">{(deleteMutation.error as Error).message}</p>}

      <form className="admin-form" onSubmit={handleCreate}>
        <h3>Новый пользователь</h3>
        <label>
          Имя
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        <label className="admin-form__checkbox">
          <input type="checkbox" checked={makeAdmin} onChange={(e) => setMakeAdmin(e.target.checked)} />
          <span>Сделать админом</span>
        </label>
        {createMutation.isError && <p className="form-error">{(createMutation.error as Error).message}</p>}
        <button type="submit" disabled={createMutation.isPending}>
          Создать пользователя
        </button>
      </form>
    </>
  );
}
