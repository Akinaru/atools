"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { KIND_LABELS, type Categories, type Category, type Kind } from "../money";

export type PickerOption = {
  value: string;
  label: string;
  emoji?: string;
  /** CSS color of the little square shown when there is no emoji. */
  color?: string;
  /** Section title shown above the first option of each group. */
  group?: string;
};

/** Colors of the line types, the same as the stickers of the journal. */
export const KIND_COLORS: Record<Kind, string> = {
  expense: "var(--mn-accent)",
  charge: "var(--mn-muted)",
  income: "#ffffff",
  savings: "var(--mn-yellow)",
  debt: "var(--mn-red)",
};

export const kindOptions = (kinds: readonly Kind[]): PickerOption[] => kinds.map((k) => ({ value: k, label: KIND_LABELS[k], color: KIND_COLORS[k] }));
export const categoryOptions = (categories: Category[]): PickerOption[] => categories.map((c) => ({ value: c.id, label: c.label, emoji: c.emoji }));

/** Every category of every type, grouped by type; values are "kind:id" (ids repeat between types, e.g. "autre"). */
export const allCategoryOptions = (categories: Categories): PickerOption[] =>
  (["expense", "charge", "income", "savings", "debt"] as const).flatMap((kind) =>
    categories[kind].map((c) => ({ value: `${kind}:${c.id}`, label: c.label, emoji: c.emoji, group: KIND_LABELS[kind], color: KIND_COLORS[kind] })),
  );

function Mark({ option }: { option: PickerOption }) {
  if (option.emoji) return <span className="w-6 shrink-0 text-center text-base leading-none">{option.emoji}</span>;
  if (option.color)
    return <span className="h-3.5 w-3.5 shrink-0 rotate-45 border-2 border-[var(--mn-ink)]" style={{ background: option.color }} aria-hidden />;
  return null;
}

/**
 * Select in the app's style: an ink-outlined button, a tilted paper list. Keyboard: ↑ ↓ to move, Enter to pick,
 * Escape to close, a letter to jump. With `name`, a hidden input carries the value in a form.
 */
export function Picker({
  value,
  onChange,
  options,
  name,
  placeholder = "Choisir…",
  disabled = false,
  ariaLabel,
  className = "",
  size = "md",
}: {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const selected = options.find((o) => o.value === value);

  // Close on a click outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Keep the active option visible while moving with the keyboard.
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const show = () => {
    if (disabled || !options.length) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
    requestAnimationFrame(() => list.current?.focus());
  };
  const pick = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
    root.current?.querySelector("button")?.focus();
  };

  const onKey = (event: KeyboardEvent) => {
    const handled = ["ArrowDown", "ArrowUp", "Enter", " ", "Escape", "Home", "End"].includes(event.key) || /^\p{L}$/u.test(event.key);
    if (!handled) return;
    // The app also listens to these keys (back, month change): they stay inside the picker.
    event.preventDefault();
    event.stopPropagation();
    if (!open) {
      if (event.key !== "Escape") show();
      return;
    }
    if (event.key === "ArrowDown") setActive((i) => Math.min(options.length - 1, i + 1));
    else if (event.key === "ArrowUp") setActive((i) => Math.max(0, i - 1));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(options.length - 1);
    else if (event.key === "Enter" || event.key === " ") pick(active);
    else if (event.key === "Escape") {
      setOpen(false);
      root.current?.querySelector("button")?.focus();
    } else {
      // Jump to the next option starting with that letter.
      const letter = event.key.toLowerCase();
      const start = (active + 1) % options.length;
      const order = [...options.slice(start), ...options.slice(0, start)];
      const found = order.find((o) => o.label.normalize("NFD").toLowerCase().startsWith(letter));
      if (found) setActive(options.indexOf(found));
    }
  };

  const pad = size === "sm" ? "px-2 py-1.5 text-sm" : "px-3 py-2 text-sm";
  return (
    <div ref={root} className={`relative ${className}`} onKeyDown={onKey}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${ariaLabel} : ${selected?.label ?? placeholder}`}
        className={`flex w-full items-center gap-2 border-2 border-[var(--mn-ink)] bg-white font-bold text-[var(--mn-ink)] transition ${pad} ${
          open ? "translate-x-[-1px] translate-y-[-1px] shadow-[3px_3px_0_var(--mn-accent),3px_3px_0_2px_var(--mn-ink)]" : "hover:shadow-[3px_3px_0_var(--mn-ink)]"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {selected && <Mark option={selected} />}
        <span className={`min-w-0 flex-1 truncate text-left ${selected ? "" : "text-zinc-400"}`}>{selected?.label ?? placeholder}</span>
        <span className={`text-xs transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          ▼
        </span>
      </button>
      {open && (
        <ul
          ref={list}
          id={id}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={`${id}-${active}`}
          className="mn-drop absolute left-0 z-40 mt-2 max-h-72 min-w-full overflow-auto border-[3px] border-[var(--mn-ink)] bg-white py-1 text-[var(--mn-ink)] shadow-[5px_6px_0_var(--mn-ink)] outline-none"
          style={{ "--mn-tilt": "-0.6deg" } as React.CSSProperties}
        >
          {options.map((option, index) => [
            option.group && option.group !== options[index - 1]?.group && (
              <li
                key={`group-${option.group}`}
                role="presentation"
                className="mn-punch flex items-center gap-2 border-t-2 border-dashed border-zinc-200 px-3 pb-1 pt-2.5 text-xs tracking-wider text-zinc-500 first:border-t-0"
              >
                {option.color && <span className="h-2.5 w-2.5 rotate-45 border-2 border-[var(--mn-ink)]" style={{ background: option.color }} aria-hidden />}
                {option.group}
              </li>
            ),
            <li
              key={option.value}
              id={`${id}-${index}`}
              role="option"
              aria-selected={option.value === value}
              onPointerEnter={() => setActive(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => pick(index)}
              className={`flex cursor-pointer items-center gap-2.5 whitespace-nowrap px-3 py-2 text-sm font-bold ${index === active ? "bg-[var(--mn-accent)]" : ""}`}
            >
              <Mark option={option} />
              <span className="flex-1">{option.label}</span>
              {option.value === value && <span aria-hidden>✓</span>}
            </li>,
          ])}
        </ul>
      )}
    </div>
  );
}
