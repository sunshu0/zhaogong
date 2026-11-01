"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { fieldBorder, type FieldTone } from "@/components/ui/input-class";
import { clickFromKeyboard, keyboardRing } from "@/components/ui/keyboard-ring";
import { listboxKey, shownLabel, typeAhead } from "@/components/ui/select-keys";
import { useMessages } from "@/i18n/client";
import { uiMessages } from "@/i18n/messages/ui";

/** `lang`: when the label is someone's own words (a job's Chinese title), zh-CN, so the English page marks it (#238). */
export type SelectOption = { value: string; label: string; lang?: string };

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
 * With `value` it is controlled (a form that replaces its values at once): the parent keeps the value and updates it
 * in `onChange`. Without `name` nothing goes into the form. A form that draws its own labels passes `id` (it goes on
 * the trigger, so `<label htmlFor>` points at it) and `hideLabel`: the label is then only read out, never shown twice.
 */
export function Select({
  name,
  label,
  options,
  value: controlled,
  defaultValue = "",
  placeholder: givenPlaceholder,
  required = false,
  onChange,
  id: triggerId,
  hideLabel = false,
  tone,
  "aria-describedby": describedBy,
}: {
  name?: string;
  label: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  onChange?: (value: string) => void;
  id?: string;
  hideLabel?: boolean;
  /** The trigger's border: a value is missing or unclear (`warn`), or not allowed (`danger`). */
  tone?: FieldTone;
  /** Put on the trigger: the notes that explain its value (a button cannot be aria-invalid). */
  "aria-describedby"?: string;
}) {
  const hydrated = useHydrated();
  const anyWord = useMessages(uiMessages).any;
  const placeholder = givenPlaceholder ?? anyWord;
  const id = useId();
  const [own, setOwn] = useState(defaultValue);
  const value = controlled ?? own;
  const labelClass = hideLabel ? "sr-only" : "block text-meta text-muted";
  const [open, setOpen] = useState<"sheet" | "dropdown" | null>(null);
  // Opened with the keyboard: the current option shows the ring from the start (keyboard-ring.ts).
  const [byKeyboard, setByKeyboard] = useState(false);
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
        <span className={labelClass}>{label}</span>
        <select
          id={triggerId}
          name={name}
          defaultValue={value}
          required={required}
          className={`h-11 w-full rounded-control border bg-surface px-3 text-body ${fieldBorder(tone)}`}
        >
          {choices.map((option) => (
            <option key={option.value} value={option.value} lang={option.lang}>
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
    setOwn(next);
    if (next !== value) onChange?.(next);
    close();
  };
  const show = (keyboard: boolean) => {
    setByKeyboard(keyboard);
    setOpen(window.matchMedia(DESKTOP).matches ? "dropdown" : "sheet");
  };

  const list = (
    <Listbox
      id={id}
      labelId={`${id}-label`}
      choices={choices}
      value={value}
      keyboard={byKeyboard}
      onPick={pick}
      onClose={() => close()}
    />
  );

  return (
    <div ref={box} className="relative space-y-1 text-body">
      <span id={`${id}-label`} className={labelClass}>
        {label}
      </span>
      <button
        ref={trigger}
        id={triggerId ?? `${id}-trigger`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open !== null}
        aria-labelledby={`${id}-label ${triggerId ?? `${id}-trigger`}`}
        aria-describedby={describedBy}
        onClick={(event) => (open ? close() : show(clickFromKeyboard(event)))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            show(true);
          }
        }}
        className={`pressable flex h-11 w-full items-center justify-between gap-2 rounded-control border bg-surface px-3 text-left focus-visible:outline-2 focus-visible:outline-brand aria-expanded:border-brand ${fieldBorder(tone)}`}
      >
        <span
          lang={choices.find((option) => option.value === value)?.lang}
          className={`truncate ${value ? "" : "text-muted"}`}
        >
          {shownLabel(choices, value, placeholder)}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 text-muted transition-transform duration-(--duration-ui) ${open ? "rotate-180" : ""}`}
        />
      </button>
      {name && <input type="hidden" name={name} value={value} />}
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
  keyboard,
  onPick,
  onClose,
}: {
  id: string;
  labelId: string;
  choices: SelectOption[];
  value: string;
  /** Opened with the keyboard. */
  keyboard: boolean;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      choices.findIndex((option) => option.value === value),
    ),
  );
  // The keyboard ring on the current option: on after a key, off when the pointer moves or presses, so it also shows
  // after a click opened the list and the arrows move in it (keyboard-ring.ts).
  const [ring, setRing] = useState(keyboard);
  const ref = useRef<HTMLUListElement>(null);
  const optionId = (index: number) => `${id}-option-${index}`;

  useEffect(() => {
    ref.current?.focus();
  }, []);
  useEffect(() => {
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  });

  const onKeyDown = (event: KeyboardEvent) => {
    setRing((before) => keyboardRing(before, { kind: "key", key: event.key }));
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
      data-keyboard={ring || undefined}
      onKeyDown={onKeyDown}
      onPointerDown={() => setRing(false)}
      className="group space-y-0.5 outline-none"
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
            onPointerMove={() => {
              setActive(index);
              setRing(false);
            }}
            className={`pressable-row flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-control px-3 md:min-h-10 ${
              // Keyboard: a brand ring (3:1 on the menu, UI audit 1); the pointer: the tint only.
              index === active
                ? "bg-background group-data-keyboard:ring-2 group-data-keyboard:ring-brand group-data-keyboard:ring-inset"
                : ""
            } ${selected ? "font-medium text-brand" : ""}`}
          >
            <span lang={option.lang}>{option.label}</span>
            {selected && <Check aria-hidden="true" className="size-4 shrink-0" />}
          </li>
        );
      })}
    </ul>
  );
}
