// 约面试 (#103): the employer picks whatever times suit them — any number, any date and minute, or none with
// 「电话联系后再定」 — and the job seeker confirms one, declines, or says in their own words when suits them. Shared by
// the browser and the server; the server parses everything a browser sends. Times are instants (ISO, UTC), shown in
// Auckland time. No contact details ride along: those follow the job's two rules (R-12, ADR 0002).

import { dateFormat } from "@/i18n/format";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";

export const INTERVIEW_TZ = "Pacific/Auckland";

export const INTERVIEW_MODES = { in_person: "到店面试", phone: "电话面试", video: "视频面试" } as const;
export type InterviewMode = keyof typeof INTERVIEW_MODES;

/** The mode's name in the page's language (Round 20); INTERVIEW_MODES is the Chinese. */
export function interviewModeName(mode: InterviewMode, lang: Lang = DEFAULT_LANG): string {
  return pick(seekerMeMessages, lang).interview.modes[mode];
}

const words = (lang: Lang) => pick(seekerMeMessages, lang).interview;

/**
 * proposed: waiting for the job seeker. confirmed: a time agreed (or, for 电话再定, the job seeker agreed to wait for
 * the call). counter: the job seeker said the times do not suit and wrote what does. declined. cancelled by the
 * employer.
 */
export type InterviewStatus = "proposed" | "confirmed" | "counter" | "declined" | "cancelled";

export const SLOT_MAX = 20;
export const PLACE_MAX = 120;
export const INTERVIEW_NOTE_MAX = 200;
export const REPLY_MAX = 200;

export type InterviewInvite = {
  /** Instants, earliest first; empty with callFirst. */
  slots: string[];
  callFirst: boolean;
  mode: InterviewMode | null;
  place: string;
  note: string;
};

/** An interview as either side sees it. */
export type InterviewView = InterviewInvite & {
  status: InterviewStatus;
  chosenSlot: string | null;
  reply: string;
  invitedAt: string;
  respondedAt: string | null;
};

export type InterviewResponse =
  { kind: "confirm"; slot: string | null } | { kind: "decline"; reply: string } | { kind: "counter"; reply: string };

const text = (value: unknown, max: number) =>
  typeof value === "string" ? [...value.trim()].slice(0, max).join("") : "";

const parts = (ms: number) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: INTERVIEW_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ms))
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute", number>;

/** Auckland's offset from UTC at an instant, in minutes. */
function offsetAt(ms: number): number {
  const p = parts(ms);
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ms / 60_000) * 60_000) / 60_000;
}

/**
 * A wall-clock time in Auckland ("2026-10-20T14:30", as <input type="datetime-local"> gives it) as an instant;
 * null when it is not one, or falls in the hour skipped when daylight saving starts.
 */
export function aucklandToInstant(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(wall) || new Date(wall).getUTCDate() !== d || h > 23 || mi > 59) return null;
  let ms = wall - offsetAt(wall) * 60_000;
  ms = wall - offsetAt(ms) * 60_000;
  const back = parts(ms);
  if (back.hour !== h || back.minute !== mi || back.day !== d) return null;
  return new Date(ms).toISOString();
}

/** The Auckland wall-clock time of an instant, for a datetime-local field. */
export function instantToAuckland(iso: string): string {
  const p = parts(Date.parse(iso));
  const two = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
}

const WEEKDAY = new Intl.DateTimeFormat("zh-CN", { timeZone: INTERVIEW_TZ, weekday: "short" });

const SLOT_EN: Intl.DateTimeFormatOptions = {
  timeZone: INTERVIEW_TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
};

/** 「10月20日周二 14:30」 / "Tue, 20 Oct, 2:30 pm" in Auckland time. */
export function formatSlot(iso: string, lang: Lang = DEFAULT_LANG): string {
  const ms = Date.parse(iso);
  if (lang === "en") return dateFormat("en", SLOT_EN).format(new Date(ms));
  const p = parts(ms);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${p.month}月${p.day}日${WEEKDAY.format(new Date(ms))} ${two(p.hour)}:${two(p.minute)}`;
}

const dayKey = (ms: number) => {
  const p = parts(ms);
  return Date.UTC(p.year, p.month - 1, p.day);
};

/** 今天 or 明天 in Auckland when the instant falls on one of them, else null. */
export function soonDay(iso: string, now: number): "今天" | "明天" | null {
  const days = (dayKey(Date.parse(iso)) - dayKey(now)) / 86_400_000;
  return days === 0 ? "今天" : days === 1 ? "明天" : null;
}

/** What the employer sent; times already past are refused, not dropped silently. */
export function parseInvite(
  value: unknown,
  now: number,
  lang: Lang = DEFAULT_LANG,
): { ok: true; invite: InterviewInvite } | { ok: false; error: string } {
  const e = words(lang).errors;
  if (!value || typeof value !== "object") return { ok: false, error: e.incomplete };
  const input = value as Record<string, unknown>;
  const callFirst = input.callFirst === true;
  const mode = typeof input.mode === "string" && input.mode in INTERVIEW_MODES ? (input.mode as InterviewMode) : null;
  const invite = { callFirst, mode, place: text(input.place, PLACE_MAX), note: text(input.note, INTERVIEW_NOTE_MAX) };
  if (callFirst) return { ok: true, invite: { ...invite, slots: [] } };
  const raw = Array.isArray(input.slots) ? input.slots : [];
  if (raw.length > SLOT_MAX) return { ok: false, error: e.tooManySlots(SLOT_MAX) };
  const slots: number[] = [];
  for (const slot of raw) {
    const ms = typeof slot === "string" && /^\d{4}-\d{2}-\d{2}T/.test(slot) ? Date.parse(slot) : NaN;
    if (Number.isNaN(ms)) return { ok: false, error: e.unreadableSlot };
    if (ms <= now) return { ok: false, error: e.slotPast(formatSlot(new Date(ms).toISOString(), lang)) };
    if (!slots.includes(ms)) slots.push(ms);
  }
  if (!slots.length) return { ok: false, error: e.noSlots };
  slots.sort((a, b) => a - b);
  return { ok: true, invite: { ...invite, slots: slots.map((ms) => new Date(ms).toISOString()) } };
}

/** The job seeker's answer to an open invitation, checked against it as it is now. */
export function parseResponse(
  value: unknown,
  interview: Pick<InterviewView, "status" | "slots" | "callFirst">,
  now: number,
  lang: Lang = DEFAULT_LANG,
): { ok: true; response: InterviewResponse } | { ok: false; error: string } {
  const e = words(lang).errors;
  if (interview.status !== "proposed") return { ok: false, error: e.changed };
  if (!value || typeof value !== "object") return { ok: false, error: e.chooseReply };
  const input = value as Record<string, unknown>;
  const reply = text(input.reply, REPLY_MAX);
  if (input.kind === "confirm") {
    if (interview.callFirst) return { ok: true, response: { kind: "confirm", slot: null } };
    const slot = typeof input.slot === "string" ? input.slot : "";
    if (!interview.slots.includes(slot)) return { ok: false, error: e.notOffered };
    if (Date.parse(slot) <= now) return { ok: false, error: e.chosenPast };
    return { ok: true, response: { kind: "confirm", slot } };
  }
  if (input.kind === "decline") return { ok: true, response: { kind: "decline", reply } };
  if (input.kind === "counter") {
    if (!reply) return { ok: false, error: e.noReply };
    return { ok: true, response: { kind: "counter", reply } };
  }
  return { ok: false, error: e.chooseReply };
}

/** The invitation's when, in a line. */
export function whenText(
  interview: Pick<InterviewView, "slots" | "callFirst" | "chosenSlot">,
  lang: Lang = DEFAULT_LANG,
): string {
  const w = words(lang);
  if (interview.chosenSlot) return formatSlot(interview.chosenSlot, lang);
  if (interview.callFirst) return w.callFirst;
  return interview.slots.map((slot) => formatSlot(slot, lang)).join(w.slotJoin);
}

/** Where the interview stands, as the job seeker reads it. */
export function seekerInterviewStatus(interview: InterviewView, lang: Lang = DEFAULT_LANG): string {
  const t = words(lang).seeker;
  switch (interview.status) {
    case "proposed":
      return interview.callFirst ? t.proposedCallFirst : t.proposed;
    case "confirmed":
      return interview.chosenSlot ? t.confirmed(formatSlot(interview.chosenSlot, lang)) : t.confirmedCallFirst;
    case "counter":
      return t.counter;
    case "declined":
      return t.declined;
    case "cancelled":
      return t.cancelled;
  }
}

/** Where the interview stands, as the employer reads it. */
export function employerInterviewStatus(interview: InterviewView, lang: Lang = DEFAULT_LANG): string {
  const t = words(lang).employer;
  switch (interview.status) {
    case "proposed":
      return t.proposed;
    case "confirmed":
      return interview.chosenSlot ? t.confirmed(formatSlot(interview.chosenSlot, lang)) : t.confirmedCallFirst;
    case "counter":
      return t.counter(interview.reply);
    case "declined":
      return interview.reply ? t.declinedWithReply(interview.reply) : t.declined;
    case "cancelled":
      return t.cancelled;
  }
}

/** One line of the workspace's to-do list, or null when there is nothing to do or know about now. */
export function interviewTodo(
  interview: InterviewView,
  side: "seeker" | "employer",
  who: string,
  now: number,
  lang: Lang = DEFAULT_LANG,
): { title: string; detail: string } | null {
  const w = words(lang);
  if (interview.status === "confirmed" && interview.chosenSlot) {
    const day = soonDay(interview.chosenSlot, now);
    if (!day || Date.parse(interview.chosenSlot) < now - 3_600_000) return null;
    const dayWord = day === "今天" ? w.today : w.tomorrow;
    return { title: w.todo.onDay(dayWord, who), detail: formatSlot(interview.chosenSlot, lang) };
  }
  if (interview.status === "proposed")
    return side === "seeker"
      ? { title: w.todo.toConfirm(who), detail: whenText(interview, lang) }
      : { title: w.todo.toConfirm(who), detail: w.todo.waitingForThem };
  if (interview.status === "counter" && side === "employer")
    return { title: w.todo.replied(who), detail: interview.reply };
  return null;
}

const escapeIcs = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines longer than 75 bytes are folded (RFC 5545 3.1), never inside a character. */
function fold(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

const icsTime = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/**
 * A calendar file for a confirmed interview with a time. It has a start only: how long it takes is the employer's
 * to say, so no end is made up.
 */
export function interviewIcs(input: {
  uid: string;
  start: string;
  title: string;
  mode: InterviewMode | null;
  place: string;
  note: string;
  stamp: string;
}): string {
  const description = [input.mode && INTERVIEW_MODES[input.mode], input.note].filter(Boolean).join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//zhaogong//interview//ZH",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${input.uid}@zhaogong`,
    `DTSTAMP:${icsTime(input.stamp)}`,
    `DTSTART:${icsTime(input.start)}`,
    `SUMMARY:${escapeIcs(input.title)}`,
    ...(input.place ? [`LOCATION:${escapeIcs(input.place)}`] : []),
    ...(description ? [`DESCRIPTION:${escapeIcs(description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Notification ids carry the change they are about, so a new invitation or answer shows as unread again. */
export const interviewInviteNotificationId = (id: string, invitedAt: string) => `interview:${id}:${invitedAt}`;
export const interviewReplyNotificationId = (id: string, respondedAt: string) => `interview-reply:${id}:${respondedAt}`;
