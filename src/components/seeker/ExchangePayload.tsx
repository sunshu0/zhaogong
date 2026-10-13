import type { ExchangePayload } from "@/lib/chat-consent";

export function PayloadView({ payload }: { payload: ExchangePayload }) {
  return (
    <dl className="space-y-2 text-sm">
      {payload.fields.map((field, index) => (
        <div key={`${field.label}-${index}`}>
          <dt className="text-xs text-muted">{field.label}</dt>
          <dd className="mt-1 whitespace-pre-line break-words">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
