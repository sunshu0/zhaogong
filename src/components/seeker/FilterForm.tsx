"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { COUNTRIES } from "@/config/countries";
import { EMPLOYMENT_TYPE_LABELS, INDUSTRY_LABELS, VISA_LABELS } from "@/i18n/labels";
import type { EmploymentType, Industry, JobFilter } from "@/lib/types";
import { filterChips, filterToQuery, parseFilter, toParams } from "@/components/seeker/filter-query";

const MIN_PAY_OPTIONS = [25, 27, 30, 35];

/**
 * Keyword box plus a filter panel. Submitting writes the filter into the URL; without JavaScript the
 * form still works as a plain GET. Give it `key={query}` so it resets when the URL changes elsewhere.
 */
export function FilterForm({ filter }: { filter: JobFilter }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const country = COUNTRIES[filter.country];
  const active = filterChips(filter).filter((c) => c.id !== "q").length;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const query = filterToQuery(parseFilter(toParams(new FormData(e.currentTarget)), filter.country));
    startTransition(() => router.push(query ? `/?${query}` : "/"));
  }

  return (
    <form action="/" onSubmit={submit} role="search" className="mb-3 lg:mb-0">
      <div className="flex gap-2">
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
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="job-filters"
          className={`shrink-0 rounded-lg border px-3 py-2 text-sm lg:hidden ${
            open || active ? "border-brand bg-brand-soft text-brand" : "border-border bg-surface"
          }`}
        >
          筛选{active > 0 && ` · ${active}`}
        </button>
      </div>

      {/* Phones open the panel with 筛选; from 1024 px it is always shown, in the page's left column. */}
      <div id="job-filters" className={`mt-2 space-y-4 rounded-xl border border-border bg-surface p-4 lg:block ${open ? "" : "hidden"}`}>
        <Group title="地区">
          {country.regions.map((r) => (
            <Chip key={r.id} type="checkbox" name="region" value={r.id} checked={filter.regionIds?.includes(r.id)}>
              {r.nameZh}
            </Chip>
          ))}
        </Group>
        <Group title="行业">
          {(Object.keys(INDUSTRY_LABELS) as Industry[]).map((id) => (
            <Chip key={id} type="checkbox" name="industry" value={id} checked={filter.industries?.includes(id)}>
              {INDUSTRY_LABELS[id].zh}
            </Chip>
          ))}
        </Group>
        <Group title="工作类型">
          {(Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[]).map((id) => (
            <Chip key={id} type="checkbox" name="type" value={id} checked={filter.employmentTypes?.includes(id)}>
              {EMPLOYMENT_TYPE_LABELS[id].zh}
            </Chip>
          ))}
        </Group>
        <Group title="最低时薪">
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
        <Group title="雇主接受的签证">
          <Chip type="radio" name="visa" value="" checked={!filter.visa}>
            不限
          </Chip>
          {country.visaTypes.map((v) => (
            <Chip key={v} type="radio" name="visa" value={v} checked={filter.visa === v}>
              {VISA_LABELS[v].zh}
            </Chip>
          ))}
        </Group>
        <Group title="食宿">
          <Chip type="checkbox" name="meals" value="1" checked={filter.mealsIncluded}>
            包餐
          </Chip>
          <Chip type="checkbox" name="housing" value="1" checked={filter.accommodationIncluded}>
            包住
          </Chip>
        </Group>

        <div className="flex gap-2 pt-1">
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

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
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
    <label className="cursor-pointer">
      <input type={type} name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      <span className="inline-block rounded-full border border-border px-3 py-1.5 text-sm peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
        {children}
      </span>
    </label>
  );
}
