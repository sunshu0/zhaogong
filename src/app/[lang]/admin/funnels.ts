// 审核数据's 漏斗 (#316, ADR 0025 §2, §5): how many visitors reached each step of a flow, from the anonymous events
// (#312). A visitor's steps join up within one New Zealand day only (the visitor key changes with the day), so a
// visitor-day reaches a step when it has one of that step's events and reached the step before. Only counts leave
// the server, never a visitor; a count of 1-4 is shown as 「少于 5」, and a rate only between two counts of 5 or more.
// Pure.
import type { Lang } from "@/i18n/lang";
import type { EventName } from "@/lib/events/catalog";

/** The periods the report offers, in days (the table keeps 180). */
export const FUNNEL_DAYS = [7, 30] as const;
export type FunnelDays = (typeof FUNNEL_DAYS)[number];

/** Counts under this are not shown as numbers. */
export const MIN_SHOWN = 5;

export type FunnelId = "seek" | "external" | "post" | "signin";
export type Role = "out" | "seeker" | "employer";
/** A column of the report: everyone, one language, or one identity. */
export type Group = "all" | Lang | Role;
export const GROUPS = {
  all: ["all"],
  lang: ["zh", "en"],
  role: ["out", "seeker", "employer"],
} as const satisfies Record<string, readonly Group[]>;
export type Breakdown = keyof typeof GROUPS;

/** The flows of ADR 0025 §2: each step is one or more events, any of which counts. */
export const FUNNELS: readonly { id: FunnelId; steps: readonly (readonly EventName[])[] }[] = [
  {
    id: "seek",
    // 申请 went (user 10-20 11:0x): chatting is how a job seeker gets in touch.
    steps: [["home_view", "jobs_list_view"], ["job_view"], ["chat_start"]],
  },
  { id: "external", steps: [["external_list_view"], ["external_view"], ["external_apply_click"]] },
  { id: "post", steps: [["post_view"], ["post_mode"], ["post_preview"], ["post_publish"]] },
  { id: "signin", steps: [["signin_view"], ["signin_code_sent"], ["signin_success"]] },
];

/** Counted on their own (ADR 0025 §2): visitor-days with the event. */
export const SINGLES = ["jobs_search", "applicants_view"] as const satisfies readonly EventName[];

/** One stored event, as much of it as the report reads. Rows come in time order. */
export interface Seen {
  visitor: string;
  day: string;
  name: string;
  lang: Lang;
  role: Role;
}

/** A shown count: the number, or "few" for 1-4. */
export type Cell = number | "few";

export interface FunnelStep {
  names: readonly EventName[];
  counts: Record<Group, Cell>;
  /** Of the flow's first step, in whole percent; null when either count is under MIN_SHOWN, or on the first step. */
  rates: Record<Group, number | null>;
}

export interface FunnelReport {
  days: number;
  funnels: { id: FunnelId; steps: FunnelStep[] }[];
  singles: { name: (typeof SINGLES)[number]; counts: Record<Group, Cell> }[];
}

const ALL_GROUPS: readonly Group[] = ["all", ...GROUPS.lang, ...GROUPS.role];

export function shownCount(n: number): Cell {
  return n > 0 && n < MIN_SHOWN ? "few" : n;
}

/** A visitor-day: the events it has, and the language and identity of its first event. */
interface VisitorDay {
  names: Set<string>;
  lang: Lang;
  role: Role;
}

function visitorDays(rows: readonly Seen[]): VisitorDay[] {
  const byKey = new Map<string, VisitorDay>();
  for (const row of rows) {
    const key = `${row.day} ${row.visitor}`;
    const seen = byKey.get(key) ?? { names: new Set<string>(), lang: row.lang, role: row.role };
    seen.names.add(row.name);
    byKey.set(key, seen);
  }
  return [...byKey.values()];
}

function tally(reached: readonly VisitorDay[]): Record<Group, number> {
  const counts = Object.fromEntries(ALL_GROUPS.map((g) => [g, 0])) as Record<Group, number>;
  for (const v of reached) {
    counts.all += 1;
    counts[v.lang] += 1;
    counts[v.role] += 1;
  }
  return counts;
}

const shown = (counts: Record<Group, number>) =>
  Object.fromEntries(ALL_GROUPS.map((g) => [g, shownCount(counts[g])])) as Record<Group, Cell>;

/** The report for `rows` (the period's events, in time order) over `days` days. */
export function funnelReport(rows: readonly Seen[], days: number): FunnelReport {
  const all = visitorDays(rows);
  const funnels = FUNNELS.map(({ id, steps }) => {
    let reached = all;
    let first: Record<Group, number> | undefined;
    const out: FunnelStep[] = steps.map((names) => {
      reached = reached.filter((v) => names.some((name) => v.names.has(name)));
      const counts = tally(reached);
      first ??= counts;
      const base = first;
      const rates = Object.fromEntries(
        ALL_GROUPS.map((g) => [
          g,
          counts === base || base[g] < MIN_SHOWN || counts[g] < MIN_SHOWN
            ? null
            : Math.round((counts[g] / base[g]) * 100),
        ]),
      ) as Record<Group, number | null>;
      return { names, counts: shown(counts), rates };
    });
    return { id, steps: out };
  });
  const singles = SINGLES.map((name) => ({ name, counts: shown(tally(all.filter((v) => v.names.has(name)))) }));
  return { days, funnels, singles };
}
