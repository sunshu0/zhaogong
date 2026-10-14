// Rebuilding a posting chat the browser sends back with each turn.
import type { JobDraft, RuleId } from "@/lib/compliance";
import type { CountryCode } from "@/lib/types";
import { TEXT_FIELDS, TOPICS, type ChatState, type QuickReply, type TextField, type Topic } from "./chat-state";
import { startChat } from "./chat-start";

const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 50) : [];

/**
 * A conversation sent back by the browser, rebuilt with known values only. The draft is cleaned by
 * the caller's own sanitizer (the server's), so this module keeps no server code.
 */
export function restoreChat(input: unknown, country: CountryCode, cleanDraft: (draft: unknown) => JobDraft): ChatState {
  const o = (typeof input === "object" && input) || {};
  const r = o as Record<string, unknown>;
  const messages = (Array.isArray(r.messages) ? r.messages : [])
    .slice(-200)
    .filter((m): m is Record<string, unknown> => typeof m === "object" && m != null && typeof m.text === "string")
    .map((m, i) => ({
      id: `m${i + 1}`,
      from: m.from === "employer" ? ("employer" as const) : ("assistant" as const),
      text: (m.text as string).slice(0, 4000),
      ...(Array.isArray(m.quickReplies) && {
        quickReplies: m.quickReplies
          .filter(
            (q): q is QuickReply => typeof q === "object" && q != null && typeof (q as QuickReply).label === "string",
          )
          .slice(0, 20)
          .map((q) => ({
            label: q.label.slice(0, 40),
            ...(typeof q.value === "string" && { value: q.value.slice(0, 2000) }),
          })),
      }),
    }));
  const f = r.fixing as Record<string, unknown> | undefined;
  const fixing =
    f && TEXT_FIELDS.includes(f.field as TextField)
      ? {
          field: f.field as TextField,
          ...(typeof f.rule === "string" && { rule: f.rule as RuleId }),
          ...(Array.isArray(f.matches) && { matches: strings(f.matches) }),
        }
      : undefined;
  return {
    country,
    draft: { ...cleanDraft(r.draft), country },
    messages: messages.length ? messages : startChat(country).messages,
    asking: TOPICS.includes(r.asking as Topic) ? (r.asking as Topic) : "description",
    ...(fixing && { fixing }),
    asked: strings(r.asked).filter((t): t is Topic => TOPICS.includes(t as Topic)),
    unsure: strings(r.unsure).filter((t): t is Topic => TOPICS.includes(t as Topic)),
    noted: strings(r.noted),
    ready: false,
  };
}
