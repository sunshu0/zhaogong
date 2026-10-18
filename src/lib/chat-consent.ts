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
  return [...items, { id, kind, offered, from: "me", status: "pending", createdAt: new Date().toISOString() }];
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
  const names = t.payloadFields;
  const fields: ExchangePayload["fields"] = [];
  const add = (label: string, value: string | undefined) => {
    if (value?.trim()) fields.push({ label, value: value.trim().slice(0, 4000) });
  };
  if (kind === "contact") {
    add(names.phone, profile.privateDetails?.phone);
    add(names.wechat, profile.privateDetails?.wechat);
    add(names.email, profile.privateDetails?.email);
  } else {
    if (!(profile.bio.trim() || profile.resume?.skills.trim())) return undefined;
    add(isEmployer ? names.businessName : names.personName, profile.name);
    add(names.headline, profile.headline);
    add(isEmployer ? names.businessBio : names.personBio, profile.bio);
    add(names.languages, profile.languages);
    add(names.availability, profile.availability);
    add(names.skills, profile.resume?.skills);
    if (profile.resume?.experienceYears != null)
      add(names.experience, names.experienceYears(profile.resume.experienceYears));
    add(names.wanted, profile.resume ? formatEmploymentTypes(profile.resume.employmentTypes) : undefined);
  }
  return fields.length ? { title: t.exchangeKinds[kind], fields } : undefined;
}
