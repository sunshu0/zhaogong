"use client";

import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { COUNTRIES } from "@/config/countries";
import { JOB_ROLE_IDS, JOB_ROLES } from "@/config/job-roles";
import { useHydrated } from "@/components/seeker/session-client";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { useMediaQuery } from "@/components/ui/use-media-query";
import { EMPLOYMENT_TYPE_LABELS, INDUSTRY_LABELS, VISA_LABELS } from "@/i18n/labels";
import { useLang, useMessages } from "@/i18n/client";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import type { EmploymentType, Industry, JobFilter } from "@/lib/types";
import {
  filterChips,
  filterGroupSummary,
  usedFilterNames,
  jobsHref,
  parseFilter,
  toParams,
  type FilterGroup,
} from "@/components/seeker/filter-query";
import { track } from "@/lib/events/track";
import { jobListQuery, parseJobOrder, type JobOrder } from "@/components/seeker/job-order-query";

const MIN_PAY_OPTIONS = [25, 27, 30, 35];
/** Where the panel becomes the page's left column (Tailwind's lg). */
const DESKTOP = "(min-width: 1024px)";

/**
 * On phones and tablets one bar above the list: keyword box + 筛选 · N. The filters come up in a bottom sheet
 * (Round 19), closed by default; 查看职位 applies them, Esc, a tap on the dimmed page or dragging the sheet down
 * closes it without applying. From 1024 px (Round 13) they are the left column of the page instead, a card: always
 * shown, checkboxes and Selects, each change applied at once. Submitting writes the filter into the URL; without
 * JavaScript the column (from 1024 px) still works as a plain GET.
 *
 * Each group (地区, 行业, ...) is one row, closed by default, that names what is chosen in it (#63: 13 regions one
 * under another made the column too long). Which groups are open outlives the form, so on desktop a group stays
 * open while its choices apply one by one.
 */
export function FilterForm({ filter, order = "latest" }: { filter: JobFilter; order?: JobOrder }) {
  const [openGroups, setOpenGroups] = useState<ReadonlySet<FilterGroup>>(new Set());
  const toggleGroup = useCallback((group: FilterGroup) => {
    setOpenGroups((open) => {
      const next = new Set(open);
      if (!next.delete(group)) next.add(group);
      return next;
    });
  }, []);
  // A new URL resets the form (and closes the panel on phones).
  return (
    <Form
      key={jobListQuery(filter, order)}
      filter={filter}
      order={order}
      openGroups={openGroups}
      toggleGroup={toggleGroup}
    />
  );
}

function Form({
  filter,
  order,
  openGroups,
  toggleGroup,
}: {
  filter: JobFilter;
  order: JobOrder;
  openGroups: ReadonlySet<FilterGroup>;
  toggleGroup: (group: FilterGroup) => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  // 筛选 waits for hydration: a tap before it was lost and the panel never opened (#90, layout.spec:107).
  const hydrated = useHydrated();
  // Before JavaScript runs the column is there (shown from 1024 px by CSS); on a phone the sheet takes over.
  const desktop = useMediaQuery(DESKTOP, true);
  const [pending, startTransition] = useTransition();
  const country = COUNTRIES[filter.country];
  const lang = useLang();
  const t = useMessages(seekerJobsMessages);
  const f = t.filter;
  const active = filterChips(filter, lang).filter((c) => c.id !== "q").length;
  // What is ticked in the panel, applied or not, for the group rows.
  const [draft, setDraft] = useState(filter);
  const readDraft = useCallback(() => {
    if (formRef.current) setDraft(parseFilter(toParams(new FormData(formRef.current)), filter.country));
  }, [filter.country]);

  // Closing without 查看职位 drops what was ticked: the sheet's inputs go, and the rows show the URL's filters again.
  const close = useCallback(() => {
    setOpen(false);
    setDraft(filter);
  }, [filter]);

  // The desktop column has no 查看职位: a change there applies at once.
  function change(e: FormEvent<HTMLFormElement>) {
    if ((e.target as HTMLInputElement).name === "q") return;
    readDraft();
    if (window.matchMedia(DESKTOP).matches) e.currentTarget.requestSubmit();
  }
  // A Select's value is a hidden input, which fires no change event: apply once React has written it.
  const selectChanged = () => setTimeout(() => formRef.current?.requestSubmit(), 0);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const sent = parseFilter(toParams(data), filter.country);
    // On a phone with the sheet closed the form holds only the keyword: keep the filters the URL already has.
    const searched = !desktop && !open ? { ...filter, query: sent.query } : sent;
    // The order's choices are in the desktop column and the open sheet; otherwise the URL's order stays.
    const query = jobListQuery(searched, data.has("sort") ? parseJobOrder(toParams(data)) : order);
    // The search funnel (#319, ADR 0025): which filters were used, by name only.
    track({ name: "jobs_search", path: "/jobs", detail: usedFilterNames(searched) || undefined });
    startTransition(() => router.push(jobsHref(query)));
  }

  const group = (id: FilterGroup) => ({
    id,
    summary: filterGroupSummary(draft, id, lang),
    open: openGroups.has(id),
    onToggle: () => toggleGroup(id),
  });

  // Checkboxes in the desktop column, pills in the phone's sheet.
  const choice = desktop ? checkChoice : chip;
  const multi = (
    <>
      <Group title={f.region} {...group("region")}>
        {country.regions.map((r) =>
          choice({
            key: r.id,
            type: "checkbox",
            name: "region",
            value: r.id,
            checked: filter.regionIds?.includes(r.id),
            label: lang === "en" ? r.nameEn : r.nameZh,
          }),
        )}
      </Group>
      <Group title={f.industry} {...group("industry")}>
        {(Object.keys(INDUSTRY_LABELS) as Industry[]).map((id) =>
          choice({
            key: id,
            type: "checkbox",
            name: "industry",
            value: id,
            checked: filter.industries?.includes(id),
            label: INDUSTRY_LABELS[id][lang],
          }),
        )}
      </Group>
      <Group title={f.role} {...group("role")}>
        {JOB_ROLE_IDS.map((id) =>
          choice({
            key: id,
            type: "checkbox",
            name: "role",
            value: id,
            checked: filter.roles?.includes(id),
            label: JOB_ROLES[id][lang],
          }),
        )}
      </Group>
      <Group title={f.type} {...group("type")}>
        {(Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[]).map((id) =>
          choice({
            key: id,
            type: "checkbox",
            name: "type",
            value: id,
            checked: filter.employmentTypes?.includes(id),
            label: EMPLOYMENT_TYPE_LABELS[id][lang],
          }),
        )}
      </Group>
    </>
  );
  const food = (
    <Group title={f.food} {...group("food")}>
      {choice({
        key: "meals",
        type: "checkbox",
        name: "meals",
        value: "1",
        checked: filter.mealsIncluded,
        label: f.meals,
      })}
      {choice({
        key: "housing",
        type: "checkbox",
        name: "housing",
        value: "1",
        checked: filter.accommodationIncluded,
        label: f.housing,
      })}
    </Group>
  );
  const minPayOptions = MIN_PAY_OPTIONS.map((n) => ({
    value: String(n),
    label: t.pay.from(`${country.currencySymbol}${n}`),
  }));
  const visaOptions = country.visaTypes.map((v) => ({ value: v, label: VISA_LABELS[v][lang] }));
  // F1: 最新 / 推荐 sits here rather than above the list, so a phone still shows three whole cards (A21). Pills in
  // both places; on desktop a change applies at once like the other choices.
  const orderChoice = (
    <fieldset aria-label={t.order.label}>
      <legend className="flex min-h-12 items-center text-body font-medium">{t.order.label}</legend>
      <div className="flex flex-wrap gap-2 pb-3">
        {(["latest", "recommended"] as const).map((value) =>
          chip({
            key: value,
            type: "radio",
            name: "sort",
            value,
            checked: order === value,
            label: t.order[value === "recommended" ? "recommendedLabel" : "latestLabel"],
          }),
        )}
      </div>
    </fieldset>
  );

  return (
    <form
      ref={formRef}
      action={jobsHref("")}
      onSubmit={submit}
      onChange={change}
      role="search"
      className="mb-3 lg:contents"
    >
      <div className="flex gap-2 lg:col-start-2 lg:row-start-1 lg:mb-3">
        <input
          type="search"
          name="q"
          defaultValue={filter.query}
          maxLength={50}
          enterKeyHint="search"
          placeholder={f.searchPlaceholder}
          aria-label={f.search}
          className="h-11 min-w-0 flex-1 rounded-control bg-surface px-3 text-base shadow-card outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!hydrated}
          aria-expanded={open}
          aria-controls="job-filters"
          className={`pressable flex h-11 shrink-0 items-center gap-1.5 rounded-control px-3 text-body shadow-card lg:hidden ${
            active ? "bg-brand-soft font-medium text-brand" : "bg-surface"
          }`}
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          {active > 0 ? f.openWithCount(active) : f.open}
        </button>
      </div>

      {desktop ? (
        <div
          id="job-filters"
          className="hidden lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:block lg:rounded-card lg:bg-surface lg:px-4 lg:pb-4 lg:shadow-card"
        >
          <div className="divide-y divide-border">
            {orderChoice}
            {multi}
            {food}
          </div>
          <div className="space-y-3 pt-3">
            <Select
              name="minPay"
              label={f.minPay}
              defaultValue={filter.minPay == null ? "" : String(filter.minPay)}
              options={minPayOptions}
              onChange={selectChanged}
            />
            <Select
              name="visa"
              label={f.visa}
              defaultValue={filter.visa ?? ""}
              options={visaOptions}
              onChange={selectChanged}
            />
          </div>
        </div>
      ) : (
        <BottomSheet
          open={open}
          onClose={close}
          title={f.title}
          footer={
            // Below the scrolling groups, so 查看职位 is always in reach and nothing shows under it.
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={(e) => {
                  // Clear every field in the sheet; a reset button would only go back to the values from the URL.
                  const form = e.currentTarget.form!;
                  for (const el of Array.from(form.elements) as HTMLInputElement[]) {
                    // The order is not a filter: 清除 leaves it.
                    if (el.name === "sort") continue;
                    if (el.type === "checkbox") el.checked = false;
                    else if (el.type === "radio") el.checked = el.value === "";
                  }
                  readDraft();
                }}
              >
                {f.clear}
              </Button>
              <Button type="submit" size="lg" loading={pending} className="flex-[2]">
                {pending ? f.finding : f.show}
              </Button>
            </div>
          }
        >
          <div id="job-filters" className="divide-y divide-border px-2">
            {orderChoice}
            {multi}
            <Group title={f.minPay} {...group("minPay")}>
              {chip({
                key: "",
                type: "radio",
                name: "minPay",
                value: "",
                checked: filter.minPay == null,
                label: f.any,
              })}
              {minPayOptions.map((o) =>
                chip({
                  key: o.value,
                  type: "radio",
                  name: "minPay",
                  value: o.value,
                  checked: filter.minPay === Number(o.value),
                  label: o.label,
                }),
              )}
            </Group>
            <Group title={f.visa} {...group("visa")}>
              {chip({ key: "", type: "radio", name: "visa", value: "", checked: !filter.visa, label: f.any })}
              {visaOptions.map((o) =>
                chip({
                  key: o.value,
                  type: "radio",
                  name: "visa",
                  value: o.value,
                  checked: filter.visa === o.value,
                  label: o.label,
                }),
              )}
            </Group>
            {food}
          </div>
        </BottomSheet>
      )}
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
          className="pressable-row -mx-2 flex min-h-12 w-[calc(100%_+_1rem)] items-center gap-1.5 rounded-control px-2 text-left text-body font-medium outline-brand focus-visible:outline-2"
        >
          <span className="shrink-0">{title}</span>
          {summary && <span className="min-w-0 truncate font-normal text-brand">· {summary}</span>}
          <ChevronDown
            aria-hidden="true"
            className={`ml-auto size-4 shrink-0 text-muted transition-transform duration-(--duration-ui) ${open ? "rotate-180" : ""}`}
          />
        </button>
      </legend>
      <div id={choices} hidden={!open} className="flex flex-wrap gap-2 pb-3 lg:flex-col lg:gap-0">
        {children}
      </div>
    </fieldset>
  );
}

type Choice = {
  key: string;
  type: "checkbox" | "radio";
  name: string;
  value: string;
  checked?: boolean;
  label: string;
};

/** A pill in the phone's sheet: tap to choose, filled and ticked when chosen (not by colour alone, UI audit 2). */
function chip({ key, type, name, value, checked, label }: Choice) {
  return (
    <label key={key} className="pressable cursor-pointer">
      <input type={type} name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      <span className="inline-flex min-h-11 items-center rounded-full bg-background px-3.5 text-body peer-checked:bg-brand-soft peer-checked:font-medium peer-checked:text-brand peer-focus-visible:outline-2 peer-focus-visible:outline-brand peer-checked:[&>svg]:block">
        <Check aria-hidden="true" strokeWidth={2.5} className="mr-1 -ml-0.5 hidden size-4 shrink-0" />
        {label}
      </span>
    </label>
  );
}

/** A checkbox in the desktop column. */
function checkChoice({ key, name, value, checked, label }: Choice) {
  return (
    <Checkbox key={key} name={name} value={value} defaultChecked={checked}>
      {label}
    </Checkbox>
  );
}
