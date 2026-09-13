import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { api } from "../api/client";
import { PersonalPlanCard } from "../components/PersonalPlanCard";
import { usePlans } from "../hooks/usePlans";
import type { PersonalPlan } from "../types/schedule";
import { addDays, dayNameRu, formatDayMonth, todayISO } from "../utils/date";

type Tab = "upcoming" | "done";

const RANGE_BEFORE_DAYS = 30;
const RANGE_AFTER_DAYS = 180;

export function PlansPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [date, setDate] = useState(todayISO());
  const [text, setText] = useState("");

  const from = addDays(todayISO(), -RANGE_BEFORE_DAYS);
  const to = addDays(todayISO(), RANGE_AFTER_DAYS);
  const { data: plans = [], isLoading } = usePlans(from, to, true);

  const createMutation = useMutation({
    mutationFn: () => api.createPlan(date, text.trim()),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (text.trim()) createMutation.mutate();
  };

  const filtered = plans
    .filter((p) => (tab === "done" ? p.done : !p.done))
    .sort((a, b) => (tab === "upcoming" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));

  const groups = new Map<string, PersonalPlan[]>();
  for (const plan of filtered) {
    const list = groups.get(plan.date) ?? [];
    list.push(plan);
    groups.set(plan.date, list);
  }

  return (
    <div className="plans-page">
      <form className="plans-page__form" onSubmit={handleSubmit}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Что запланировать?"
          required
        />
        <button type="submit" disabled={createMutation.isPending}>
          Добавить
        </button>
      </form>
      {createMutation.isError && <p className="form-error">{(createMutation.error as Error).message}</p>}

      <div className="subjects-page__tabs">
        <button type="button" className={tab === "upcoming" ? "active" : ""} onClick={() => setTab("upcoming")}>
          Предстоящие
        </button>
        <button type="button" className={tab === "done" ? "active" : ""} onClick={() => setTab("done")}>
          Выполненные
        </button>
      </div>

      {isLoading && <p className="subjects-page__empty">Загрузка…</p>}
      {!isLoading && groups.size === 0 && <p className="subjects-page__empty">Пусто.</p>}

      <div className="plans-page__groups">
        {[...groups.entries()].map(([groupDate, groupPlans]) => (
          <div key={groupDate} className="plans-page__group">
            <div className="plans-page__group-date">
              {dayNameRu(groupDate)}, {formatDayMonth(groupDate)}
            </div>
            {groupPlans.map((plan) => (
              <PersonalPlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
