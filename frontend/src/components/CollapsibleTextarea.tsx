import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  /** Last-persisted value — used only to decide the default collapsed state after a save/reload, so a long saved comment starts collapsed but an in-progress edit never snaps shut under the typist. */
  savedValue: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder?: string;
  /** True once a plain user is looking at already-entered homework — the backend only lets them add (empty → text), not edit further; expanding still shows the full text, just as plain text instead of an editable field. */
  readOnly?: boolean;
}

/**
 * A homework comment that can be long enough to distort the week/two-week
 * view's shared time-axis grid (every day column shares that row's height,
 * so one long comment stretches the whole row across unrelated days) — see
 * WeekTimeGrid.tsx. Collapsed by default once a comment is saved, showing a
 * one-line preview behind a disclosure triangle; expanding reveals the full
 * text in an editable textarea that grows to exactly fit its content (via
 * scrollHeight, not a rows guess) so nothing is ever clipped or scrolled.
 */
export function CollapsibleTextarea({ value, savedValue, onChange, onBlur, placeholder, readOnly = false }: Props) {
  const [collapsed, setCollapsed] = useState(Boolean(savedValue));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setCollapsed(Boolean(savedValue));
  }, [savedValue]);

  const fitHeight = (): void => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // Re-fit whenever the text changes (typing, or switching to a different
  // occurrence's already-expanded field) and once right after expanding,
  // since a just-mounted textarea's scrollHeight isn't available yet on the
  // same render that flips `collapsed`.
  useEffect(() => {
    if (!collapsed) fitHeight();
  }, [value, collapsed]);

  return (
    <div className="collapsible-textarea">
      <button
        type="button"
        className={`collapsible-textarea__toggle${collapsed ? "" : " collapsible-textarea__toggle--open"}`}
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Показать дз полностью" : "Свернуть дз"}
      >
        ▶
      </button>
      {collapsed ? (
        <div
          className={`collapsible-textarea__preview${value ? "" : " collapsible-textarea__preview--placeholder"}`}
          onClick={() => setCollapsed(false)}
        >
          {value || placeholder}
        </div>
      ) : readOnly ? (
        <div className="collapsible-textarea__readonly">{value || placeholder}</div>
      ) : (
        <textarea
          ref={textareaRef}
          className="collapsible-textarea__field"
          value={value}
          placeholder={placeholder}
          rows={2}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onInput={fitHeight}
          autoFocus={!savedValue}
        />
      )}
    </div>
  );
}
