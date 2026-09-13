import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import type { PersonalPlan } from "../types/schedule";

interface Props {
  plan: PersonalPlan;
}

export function PersonalPlanCard({ plan }: Props) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(plan.text);
  const [editing, setEditing] = useState(false);

  // Rendered both on the dedicated "Мои планы" page (query key "plans") and
  // inline in the schedule views (query key "overview", see useOverview) —
  // invalidate both so either context picks up the change.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["plans"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
  };

  const doneMutation = useMutation({
    mutationFn: (done: boolean) => api.updatePlan(plan.id, { done }),
    onSuccess: invalidate,
  });

  const textMutation = useMutation({
    mutationFn: (value: string) => api.updatePlan(plan.id, { text: value }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deletePlan(plan.id),
    onSuccess: invalidate,
  });

  const handleBlur = (): void => {
    setEditing(false);
    const trimmed = text.trim();
    if (trimmed && trimmed !== plan.text) textMutation.mutate(trimmed);
    else setText(plan.text);
  };

  const handleDelete = (): void => {
    if (window.confirm("Удалить этот план?")) deleteMutation.mutate();
  };

  return (
    <div className={`plan-card${plan.done ? " plan-card--done" : ""}`} onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        checked={plan.done}
        onChange={(e) => doneMutation.mutate(e.target.checked)}
        className="plan-card__done"
      />
      {editing ? (
        <textarea
          className="plan-card__text-input"
          value={text}
          rows={2}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
        />
      ) : (
        <span className="plan-card__text" onClick={() => setEditing(true)}>
          {plan.text}
        </span>
      )}
      <button type="button" className="plan-card__delete" onClick={handleDelete} title="Удалить">
        ×
      </button>
    </div>
  );
}
