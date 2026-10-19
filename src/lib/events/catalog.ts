// The events behind the funnels (#312, ADR 0025 §4): every name, the `detail` values it may carry and whether it
// is about a job. /api/events and recordEvent() take nothing that is not here, so a new event means changing this
// list and the ADR's table first. Pure: the browser's track() and the server read the same list.

/** The job filters a search may have used (filter-query.ts): their names only, never their values. */
export const FILTER_NAMES = ["q", "region", "industry", "role", "type", "minPay", "visa", "meals", "housing"] as const;

interface EventSpec {
  /** The values `detail` may take; "filters" is a comma-separated list of FILTER_NAMES. Absent: no detail. */
  readonly detail?: readonly string[] | "filters";
  /** Whether the event is about one job (job_id is then required). */
  readonly job?: true;
}

export const EVENTS = {
  home_view: {},
  jobs_list_view: { detail: ["filtered", "all"] },
  jobs_search: { detail: "filters" },
  job_view: { job: true },
  chat_start: { job: true, detail: ["signed_out"] },
  apply_open: { job: true },
  apply_submit: { job: true },
  external_list_view: { detail: ["internship", "professional"] },
  external_view: { job: true },
  external_apply_click: { job: true, detail: ["demo"] },
  signin_view: { detail: ["seeker", "employer"] },
  signin_code_sent: {},
  signin_success: { detail: ["new", "returning"] },
  post_view: {},
  post_mode: { detail: ["chat", "paste", "form"] },
  post_preview: {},
  post_publish: { job: true, detail: ["live", "pending_review"] },
  applicants_view: { job: true },
} as const satisfies Record<string, EventSpec>;

export type EventName = keyof typeof EVENTS;

/** What an event carries besides who and when; the route template is the page's, without its query. */
export interface EventInput {
  name: EventName;
  path: string;
  jobId?: string;
  detail?: string;
}

const PATH = /^\/[a-z0-9/[\]._-]{0,79}$/;
const JOB_ID = /^[A-Za-z0-9:_-]{1,80}$/;

/** The event as it may be stored, or null when anything in it is not on the list (a name, a detail, a path). */
export function checkEvent(input: unknown): EventInput | null {
  if (!input || typeof input !== "object") return null;
  const { name, path, jobId, detail } = input as Record<string, unknown>;
  if (typeof name !== "string" || !Object.hasOwn(EVENTS, name)) return null;
  const spec: EventSpec = EVENTS[name as EventName];
  if (typeof path !== "string" || !PATH.test(path)) return null;

  const event: EventInput = { name: name as EventName, path };
  if (spec.job) {
    if (typeof jobId !== "string" || !JOB_ID.test(jobId)) return null;
    event.jobId = jobId;
  } else if (jobId !== undefined) return null;

  if (detail === undefined || detail === "") return event;
  if (typeof detail !== "string" || !spec.detail) return null;
  if (spec.detail === "filters") {
    const names = detail.split(",");
    const known: readonly string[] = FILTER_NAMES;
    if (names.length > FILTER_NAMES.length || !names.every((n) => known.includes(n))) return null;
    event.detail = [...new Set(names)].join(",");
  } else {
    if (!spec.detail.includes(detail)) return null;
    event.detail = detail;
  }
  return event;
}
