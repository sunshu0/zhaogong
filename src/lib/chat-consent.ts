import type { Profile } from "@/components/seeker/hub-state";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { chatMessages } from "@/i18n/messages/chat";
import { formatEmploymentTypes } from "@/lib/employment-types";

export type ExchangeKind = "contact" | "resume";
export type ExchangePayload = { title: string; fields: { label: string; value: string }[] };
export type Exchange = {
  id: string;
  kind: ExchangeKind;
  from: "me" | "them";
  status: "pending" | "accepted" | "rejected" | "cancelled";
  offered: ExchangePayload;
  response?: ExchangePayload;
  createdAt: string;
  respondedAt?: string;
  demo?: boolean;
};
/** What the two sides may swap, in Chinese; a reader's own language comes from the chat dictionary. */
export const EXCHANGE_LABELS: Record<ExchangeKind, string> = chatMessages.zh.exchangeKinds;

/**
 * The field names a payload may carry. A payload is stored and read by both sides, so a field keeps its key here
 * (never a word in the writer's language) and each reader turns it into a label with its own dictionary
 * (payloadFields, by PayloadView).
 */
export const PAYLOAD_FIELD_KEYS = [
  "phone",
  "wechat",
  "email",
  "businessName",
  "personName",
  "headline",
  "businessBio",
  "personBio",
  "languages",
  "availability",
  "skills",
  "experience",
  "wanted",
] as const;
export type PayloadFieldKey = (typeof PAYLOAD_FIELD_KEYS)[number];

/** Payloads stored before the keys (and the demo ones) carry the Chinese label itself. */
const LABEL_KEYS: Record<string, PayloadFieldKey> = Object.fromEntries(
  PAYLOAD_FIELD_KEYS.map((key) => [chatMessages.zh.payloadFields[key], key]),
);

/** Which field a stored label stands for: its key, or the Chinese label an older payload was stored with. */
export function payloadFieldKey(label: string): PayloadFieldKey | undefined {
  return (PAYLOAD_FIELD_KEYS as readonly string[]).includes(label) ? (label as PayloadFieldKey) : LABEL_KEYS[label];
}

export function parsePayload(value: unknown): ExchangePayload | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as ExchangePayload;
  if (
    typeof input.title !== "string" ||
    !input.title.trim() ||
    input.title.length > 100 ||
    !Array.isArray(input.fields) ||
    !input.fields.length ||
    input.fields.length > 20
  )
    return undefined;
  if (
    !input.fields.every(
      (field) =>
        field &&
        typeof field.label === "string" &&
        field.label.length <= 100 &&
        typeof field.value === "string" &&
        field.value.trim() &&
        field.value.length <= 4000,
    )
  )
    return undefined;
  return { title: input.title, fields: input.fields.map(({ label, value }) => ({ label, value })) };
}

export function parseExchange(value: unknown): Exchange | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Exchange;
  const offered = parsePayload(input.offered);
  const response = parsePayload(input.response);
  if (
    typeof input.id !== "string" ||
    !input.id ||
    !["contact", "resume"].includes(input.kind) ||
    !["me", "them"].includes(input.from) ||
    !["pending", "accepted", "rejected", "cancelled"].includes(input.status) ||
    typeof input.createdAt !== "string" ||
    !offered
  )
    return undefined;
  if (input.status === "accepted" ? !response || typeof input.respondedAt !== "string" : input.response !== undefined)
    return undefined;
  return {
    id: input.id,
    kind: input.kind,
    from: input.from,
    status: input.status,
    offered,
    createdAt: input.createdAt,
    ...(response ? { response } : {}),
    ...(typeof input.respondedAt === "string" ? { respondedAt: input.respondedAt } : {}),
    ...(input.demo === true ? { demo: true } : {}),
  };
}

/**
 * Requests of one kind a conversation keeps (#366): a request turned down or withdrawn may be made again, and each
 * new one would stay as well. Normal use (asking again once or twice) shows every one; past that, a new request
 * drops the oldest closed ones of its kind, so with it there are at most this many.
 */
export const EXCHANGES_PER_KIND_MAX = 3;

const closed = (item: Exchange) => item.status === "rejected" || item.status === "cancelled";

/**
 * The exchanges with a new request from me (oldest first, as kept); the same list when one of the kind is pending or
 * accepted, or the offer is not one. The oldest closed requests of the kind past EXCHANGES_PER_KIND_MAX are left out.
 */
export function requestExchange(
  items: Exchange[],
  kind: ExchangeKind,
  offered: ExchangePayload,
  id: string,
): Exchange[] {
  if (
    !parsePayload(offered) ||
    items.some((item) => item.kind === kind && ["pending", "accepted"].includes(item.status))
  )
    return items;
  const ofKind = items.filter((item) => item.kind === kind && closed(item));
  const dropped = new Set(ofKind.slice(0, Math.max(0, ofKind.length - (EXCHANGES_PER_KIND_MAX - 1))));
  return [
    ...items.filter((item) => !dropped.has(item)),
    { id, kind, offered, from: "me", status: "pending", createdAt: new Date().toISOString() },
  ];
}

export function respondExchange(
  item: Exchange,
  actor: "me" | "them",
  status: "accepted" | "rejected" | "cancelled",
  response?: ExchangePayload,
): Exchange {
  if (
    item.status !== "pending" ||
    (status === "cancelled" ? item.from !== actor : item.from === actor) ||
    (status === "accepted" && !parsePayload(response))
  )
    return item;
  return { ...item, status, respondedAt: new Date().toISOString(), ...(status === "accepted" ? { response } : {}) };
}

/**
 * What each side sees of an exchange. The side that asks offers its own details first: the other side sees them
 * as soon as the request arrives, until it is withdrawn. The asker sees the other side's details only once they
 * agree; a refusal gives nothing back.
 */
export function visibleExchange(item: Exchange): { me?: ExchangePayload; them?: ExchangePayload } | undefined {
  if (item.status === "accepted" && item.response)
    return item.from === "me" ? { me: item.offered, them: item.response } : { me: item.response, them: item.offered };
  if (item.status === "pending") return item.from === "me" ? { me: item.offered } : { them: item.offered };
  return undefined;
}

export function profilePayload(
  profile: Profile,
  kind: ExchangeKind,
  isEmployer: boolean,
  lang: Lang = DEFAULT_LANG,
): ExchangePayload | undefined {
  const t = pick(chatMessages, lang);
  const fields: ExchangePayload["fields"] = [];
  // The label is the field's key: the other side reads it in its own language (PayloadView). The values are the
  // person's own words and are stored as they wrote them; 岗位经验 keeps the number, so each side reads「3 年」
  // or "3 years".
  const add = (label: PayloadFieldKey, value: string | undefined) => {
    if (value?.trim()) fields.push({ label, value: value.trim().slice(0, 4000) });
  };
  if (kind === "contact") {
    add("phone", profile.privateDetails?.phone);
    add("wechat", profile.privateDetails?.wechat);
    add("email", profile.privateDetails?.email);
  } else {
    if (!(profile.bio.trim() || profile.resume?.skills.trim())) return undefined;
    add(isEmployer ? "businessName" : "personName", profile.name);
    add("headline", profile.headline);
    add(isEmployer ? "businessBio" : "personBio", profile.bio);
    add("languages", profile.languages);
    add("availability", profile.availability);
    add("skills", profile.resume?.skills);
    if (profile.resume?.experienceYears != null) add("experience", String(profile.resume.experienceYears));
    add("wanted", profile.resume ? formatEmploymentTypes(profile.resume.employmentTypes) : undefined);
  }
  return fields.length ? { title: t.exchangeKinds[kind], fields } : undefined;
}
