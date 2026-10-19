// POST /api/events (#312, ADR 0025 §4): the browser's track() sends one funnel event here with navigator.sendBeacon.
// Body: { name, path, jobId?, detail? } as JSON. Only names and values on the list are stored (catalog.ts); the
// answer says nothing either way (204), so it cannot be used to probe anything.
import { recordRequestEvent } from "@/lib/events/record";

const BODY_MAX = 1_000;

export async function POST(request: Request) {
  const text = await request.text().catch(() => "");
  if (text.length > 0 && text.length <= BODY_MAX) {
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      // Not JSON: nothing to store.
    }
    await recordRequestEvent(body);
  }
  return new Response(null, { status: 204 });
}
