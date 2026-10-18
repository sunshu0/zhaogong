"use client";

import { payloadFieldKey, type ExchangePayload } from "@/lib/chat-consent";
import { useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { chatMessages } from "@/i18n/messages/chat";

/**
 * What one side hands over. A payload is stored once and read by both sides, so its field names are keys
 * (chat-consent's PAYLOAD_FIELD_KEYS) and are named here in the reader's own language; the values are the person's
 * own words and are shown as they wrote them. A label from before the keys, or from a demo payload, is Chinese and
 * is looked up the same way.
 */
export function PayloadView({ payload }: { payload: ExchangePayload }) {
  const names = useMessages(chatMessages).payloadFields;
  return (
    <dl className="space-y-2 text-sm">
      {payload.fields.map((field, index) => {
        const key = payloadFieldKey(field.label);
        const value =
          key === "experience" && /^\d+$/.test(field.value) ? names.experienceYears(Number(field.value)) : field.value;
        return (
          <div key={`${field.label}-${index}`}>
            <dt className="text-xs text-muted">{key ? names[key] : field.label}</dt>
            <dd lang={contentLang(value)} className="mt-1 whitespace-pre-line break-words">
              {value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
