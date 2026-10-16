"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { listboxKey, shownLabel, typeAhead } from "@/components/ui/select-keys";

export type SelectOption = { value: string; label: string };

/** The width from which Select opens as a dropdown under itself rather than as a bottom sheet (Tailwind's md). */
const DESKTOP = "(min-width: 48rem)";

const noop = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

/**
 * A select (Round 19) in place of the browser's own: on a phone its options come up in a BottomSheet, from 768 px in
 * a dropdown under it; either way they can be chosen with the keyboard (select-keys.ts). The value goes into the
 * form as a hidden input named `name`, so a GET form submits it as it did a <select>. Before JavaScript runs (and
 * without it) it is a plain <select>, so the form still works.
 * `placeholder` is the empty choice (不限) and comes first unless `required`.
 */
export function Select({
  name,
  label,
  options,
  defaultValue = "",
  placeholder = "不限",
  required = false,
  onChange,
}: {
  name: string;
  label: string;
  options: SelectOption[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  const hydrated = useHydrated();
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState<"sheet" | "dropdown" | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const choices = required ? options : [{ value: "", label: placeholder }, ...options];

  // A dropdown closes when the pointer goes down anywhere else.
  useEffect(() => {
    if (open !== "dropdown") return;
    const outside = (event: Event) => {
      if (!box.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  if (!hydrated) {
    return (
      <label className="block space-y-1 text-body">
        <span className="text-meta text-muted">{label}</span>
        <select
          name={name}
          defaultValue={defaultValue}
          required={required}
          className="h-11 w-full rounded-control border border-border bg-surface px-3 text-body"
        >
          {choices.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const close = (focusTrigger = true) => {
    setOpen(null);
    if (focusTrigger) trigger.current?.focus();
  };
  const pick = (next: string) => {
    setValue(next);
    if (next !== value) onChange?.(next);
    close();
  };
  const show = () => setOpen(window.matchMedia(DESKTOP).matches ? "dropdown" : "sheet");

  const list = (
    <Listbox id={id} labelId={`${id}-label`} choices={choices} value={value} onPick={pick} onClose={() => close()} />
  );

  return (
    <div ref={box} className="relative space-y-1 text-body">
      <span id={`${id}-label`} className="block text-meta text-muted">
        {label}
      </span>
      <button
        ref={trigger}
        id={`${id}-trigger`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open !== null}
        aria-labelledby={`${id}-label ${id}-trigger`}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            show();
          }
        }}
        className="pressable flex h-11 w-full items-center justify-between gap-2 rounded-control border border-border bg-surface px-3 text-left hover:border-muted focus-visible:outline-2 focus-visible:outline-brand aria-expanded:border-brand"
      >
        <span className={`truncate ${value ? "" : "text-muted"}`}>{shownLabel(choices, value, placeholder)}</span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 text-muted transition-transform duration-(--duration-ui) ${open ? "rotate-180" : ""}`}
        />
      </button>
      <input type="hidden" name={name} value={value} />
      {open === "dropdown" && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 animate-pop-in overflow-y-auto rounded-control bg-surface p-1 shadow-pop">
          {list}
        </div>
      )}
      <BottomSheet open={open === "sheet"} onClose={() => close()} title={label}>
        {list}
      </BottomSheet>
    </div>
  );
}

function Listbox({
  id,
  labelId,
  choices,
  value,
  onPick,
  onClose,
}: {
  id: string;
  labelId: string;
  choices: SelectOption[];
  value: string;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      choices.findIndex((option) => option.value === value),
    ),
  );
  const ref = useRef<HTMLUListElement>(null);
  const optionId = (index: number) => `${id}-option-${index}`;

  useEffect(() => {
    ref.current?.focus();
  }, []);
  useEffect(() => {
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  });

  const onKeyDown = (event: KeyboardEvent) => {
    const action = listboxKey(event.key, active, choices.length);
    const jump = action
      ? -1
      : typeAhead(
          choices.map((option) => option.label),
          event.key,
          active,
        );
    if (!action && jump < 0) return;
    if (!action || event.key !== "Tab") event.preventDefault();
    if (jump >= 0) setActive(jump);
    else if (action && "move" in action) setActive(action.move);
    else if (action && "pick" in action) onPick(choices[action.pick].value);
    else onClose();
  };

  return (
    <ul
      ref={ref}
      role="listbox"
      aria-labelledby={labelId}
      aria-activedescendant={optionId(active)}
      tabIndex={0}
      data-autofocus
      onKeyDown={onKeyDown}
      className="space-y-0.5 outline-none"
    >
      {choices.map((option, index) => {
        const selected = option.value === value;
        return (
          <li
            key={option.value}
            id={optionId(index)}
            role="option"
            aria-selected={selected}
            onClick={() => onPick(option.value)}
            onPointerMove={() => setActive(index)}
            className={`pressable-row flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-control px-3 md:min-h-10 ${
              index === active ? "bg-background" : ""
            } ${selected ? "font-medium text-brand" : ""}`}
          >
            <span>{option.label}</span>
            {selected && <Check aria-hidden="true" className="size-4 shrink-0" />}
          </li>
        );
      })}
    </ul>
  );
}
