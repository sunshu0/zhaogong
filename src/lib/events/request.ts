// Which requests never make an event (#312, ADR 0025 §4): crawlers, and prefetches the browser or Next makes before
// anyone opened the page. The User-Agent is only looked at here; it is never stored.

// Not "headless": the browser tests run headless Chromium (HeadlessChrome in its User-Agent) and must record.
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|bingpreview|lighthouse/i;

/** Whether a request with these headers is a crawler's or a prefetch, so it records nothing. */
export function isBotOrPrefetch(headers: Headers): boolean {
  if (BOT.test(headers.get("user-agent") ?? "")) return true;
  if (headers.has("next-router-prefetch")) return true;
  const purpose = `${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""}`.toLowerCase();
  return purpose.includes("prefetch");
}
