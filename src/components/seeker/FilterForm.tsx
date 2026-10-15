"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { COUNTRIES } from "@/config/countries";
import { EMPLOYMENT_TYPE_LABELS, INDUSTRY_LABELS, VISA_LABELS } from "@/i18n/labels";
import type { EmploymentType, Industry, JobFilter } from "@/lib/types";
import {
  filterChips,
  filterGroupSummary,
  filterToQuery,
  jobsHref,
  parseFilter,
  toParams,
  type FilterGroup,
} from "@/components/seeker/filter-query";

const MIN_PAY_OPTIONS = [25, 27, 30, 35];
/** Where the panel becomes the page's left column (Tailwind's lg). */
const DESKTOP = "(min-width: 1024px)";

/**
 * On phones and tablets one bar above the list: keyword box + 筛选 · N. The panel drops down under the bar, closed
 * by default; 查看职位 applies it, Esc or a tap outside closes it without applying. From 1024 px (Round 13) the
 * panel is the left column of the page instead: always shown, plain checkboxes, each change applied at once.
 * Submitting writes the filter into the URL; without JavaScript the form still works as a plain GET.
 *
 * Each group (地区, 行业, ...) is one row, closed by default, that names what is chosen in it (#63: 13 regions one
 * under another made the column too long). Which groups are open outlives the form, so on desktop a group stays
 * open while its choices apply one by one.
 */
export function FilterForm({ filter }: { filter: JobFilter }) {
  const [openGroups, setOpenGroups] = useState<ReadonlySet<FilterGroup>>(new Set());
  const toggleGroup = useCallback((group: FilterGroup) => {
    setOpenGroups((open) => {
      const next = new Set(open);
      if (!next.delete(group)) next.add(group);
      return next;
    });
  }, []);
  // A new URL resets the form (and closes the panel on phones).
  return <Form key={filterToQuery(filter)} filter={filter} openGroups={openGroups} toggleGroup={toggleGroup} />;
}

function Form({
  filter,
  openGroups,
  toggleGroup,
}: {
  filter: JobFilter;
  openGroups: ReadonlySet<FilterGroup>;
  toggleGroup: (group: FilterGroup) => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const country = COUNTRIES[filter.country];
  const active = filterChips(filter).filter((c) => c.id !== "q").length;
  // What is ticked in the panel, applied or not, for the group rows.
  const [draft, setDraft] = useState(filter);
  const readDraft = useCallback(() => {
    if (formRef.current) setDraft(parseFilter(toParams(new FormData(formRef.current)), filter.country));
  }, [filter.country]);

  // Closing without 查看职位 puts the panel back to the filters in the URL.
  const close = useCallback(
    (returnFocus: boolean) => {
      for (const input of formRef.current?.querySelectorAll<HTMLInputElement>("#job-filters input") ?? []) {
        input.checked = input.defaultChecked;
      }
      readDraft();
      setOpen(false);
      if (returnFocus) toggleRef.current?.focus();
    },
    [readDraft],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!formRef.current?.contains(e.target as Node)) close(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // The desktop column has no 查看职位: a change there applies at once.
  function change(e: FormEvent<HTMLFormElement>) {
    if ((e.target as HTMLInputElement).name === "q") return;
    readDraft();
    if (window.matchMedia(DESKTOP).matches) e.currentTarget.requestSubmit();
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const query = filterToQuery(parseFilter(toParams(new FormData(e.currentTarget)), filter.country));
    startTransition(() => router.push(jobsHref(query)));
  }

  const group = (id: FilterGroup) => ({
    id,
    summary: filterGroupSummary(draft, id),
    open: openGroups.has(id),
    onToggle: () => toggleGroup(id),
  });

  return (
    <form
      ref={formRef}
      action={jobsHref("")}
      onSubmit={submit}
      onChange={change}
      role="search"
      className="relative mb-3 lg:contents"
    >
      <div className="flex gap-2 lg:col-start-2 lg:row-start-1 lg:mb-3">
        <input
          type="search"
          name="q"
          defaultValue={filter.query}
          maxLength={50}
          enterKeyHint="search"
          placeholder="搜索职位，如 服务员、厨师"
          aria-label="搜索职位"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none focus:border-brand"
        />
        <button
          ref={toggleRef}
          type="button"
          onClick={() => (open ? close(false) : setOpen(true))}
          aria-expanded={open}
          aria-controls="job-filters"
          className={`shrink-0 rounded-lg border px-3 py-2 text-sm lg:hidden ${
            open || active ? "border-brand bg-brand-soft text-brand" : "border-border bg-surface"
          }`}
        >
          筛选{active > 0 && ` · ${active}`}
        </button>
      </div>

      {/* z-15: over the list's 收藏 buttons (z-10), under the sticky header (z-20). */}
      <div
        id="job-filters"
        className={`absolute inset-x-0 top-full z-15 mt-2 max-h-[min(75vh,40rem)] overflow-y-auto rounded-xl border border-border bg-surface px-4 pt-1 shadow-lg lg:static lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:block lg:max-h-none lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none ${
          open ? "" : "hidden"
        }`}
      >
        <div className="divide-y divide-border lg:border-y lg:border-border">
          <Group title="地区" {...group("region")}>
            {country.regions.map((r) => (
              <Chip key={r.id} type="checkbox" name="region" value={r.id} checked={filter.regionIds?.includes(r.id)}>
                {r.nameZh}
              </Chip>
            ))}
          </Group>
          <Group title="行业" {...group("industry")}>
            {(Object.keys(INDUSTRY_LABELS) as Industry[]).map((id) => (
              <Chip key={id} type="checkbox" name="industry" value={id} checked={filter.industries?.includes(id)}>
                {INDUSTRY_LABELS[id].zh}
              </Chip>
            ))}
          </Group>
          <Group title="工作类型" {...group("type")}>
            {(Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[]).map((id) => (
              <Chip key={id} type="checkbox" name="type" value={id} checked={filter.employmentTypes?.includes(id)}>
                {EMPLOYMENT_TYPE_LABELS[id].zh}
              </Chip>
            ))}
          </Group>
          <Group title="最低时薪" {...group("minPay")}>
            <Chip type="radio" name="minPay" value="" checked={filter.minPay == null}>
              不限
            </Chip>
            {MIN_PAY_OPTIONS.map((n) => (
              <Chip key={n} type="radio" name="minPay" value={String(n)} checked={filter.minPay === n}>
                {country.currencySymbol}
                {n} 起
              </Chip>
            ))}
          </Group>
          <Group title="雇主接受的签证" {...group("visa")}>
            <Chip type="radio" name="visa" value="" checked={!filter.visa}>
              不限
            </Chip>
            {country.visaTypes.map((v) => (
              <Chip key={v} type="radio" name="visa" value={v} checked={filter.visa === v}>
                {VISA_LABELS[v].zh}
              </Chip>
            ))}
          </Group>
          <Group title="食宿" {...group("food")}>
            <Chip type="checkbox" name="meals" value="1" checked={filter.mealsIncluded}>
              包餐
            </Chip>
            <Chip type="checkbox" name="housing" value="1" checked={filter.accommodationIncluded}>
              包住
            </Chip>
          </Group>
        </div>

        {/* Stays at the bottom of the panel while the groups scroll, so 查看职位 is always in reach. */}
        <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-surface px-4 py-3 lg:hidden">
          <button
            type="button"
            className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm"
            onClick={(e) => {
              // Clear every panel field; a reset button would only go back to the values from the URL.
              const form = e.currentTarget.form!;
              for (const el of Array.from(form.elements) as HTMLInputElement[]) {
                if (el.type === "checkbox") el.checked = false;
                else if (el.type === "radio") el.checked = el.value === "";
              }
              readDraft();
            }}
          >
            清空条件
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex-[2] rounded-lg bg-brand px-3 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "正在查找…" : "查看职位"}
          </button>
        </div>
      </div>
    </form>
  );
}

/** One group of choices: a row with its name and what is chosen in it, which opens to show the choices. */
function Group({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  id: FilterGroup;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const choices = `filter-group-${id}`;
  return (
    // Named by the title alone, whatever the row says is chosen.
    <fieldset aria-label={title}>
      <legend className="w-full">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={choices}
          className="flex min-h-11 w-full items-center gap-1.5 py-2 text-left text-body font-medium outline-brand focus-visible:outline-2"
        >
          <span className="shrink-0">{title}</span>
          {summary && <span className="min-w-0 truncate font-normal text-brand">· {summary}</span>}
          <ChevronDown
            aria-hidden="true"
            className={`ml-auto size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </legend>
      <div id={choices} hidden={!open} className="flex flex-wrap gap-2 pb-3 lg:flex-col lg:gap-1">
        {children}
      </div>
    </fieldset>
  );
}

function Chip({
  type,
  name,
  value,
  checked,
  children,
}: {
  type: "checkbox" | "radio";
  name: string;
  value: string;
  checked?: boolean;
  children: ReactNode;
}) {
  return (
    // A pill on phones; a plain checkbox or radio with its label in the desktop column.
    <label className="cursor-pointer lg:flex lg:min-h-8 lg:items-center lg:gap-2">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={checked}
        className="peer sr-only lg:not-sr-only lg:size-4 lg:accent-brand"
      />
      <span className="inline-block rounded-full border border-border px-3 py-1.5 text-sm peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand peer-focus-visible:outline-2 peer-focus-visible:outline-brand lg:rounded-none lg:border-0 lg:p-0 lg:text-body lg:peer-checked:bg-transparent lg:peer-checked:text-foreground lg:peer-focus-visible:outline-0">
        {children}
      </span>
    </label>
  );
}
