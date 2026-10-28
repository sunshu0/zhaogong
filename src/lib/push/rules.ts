// Only browser vendors' Web Push endpoints, never arbitrary user-supplied URLs (SSRF).
const PROVIDERS = new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
export type PushRole = "seeker" | "employer";
export type BrowserSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export function decode64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));
}
export function encode64(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
export function pushEndpoint(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return;
  try {
    const url = new URL(value);
    const provider = PROVIDERS.has(url.hostname) || /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || !provider) return;
    if (url.pathname.length < 2) return;
    return url.href;
  } catch {
    return;
  }
}
export function parseSubscription(value: unknown): BrowserSubscription | undefined {
  if (!value || typeof value !== "object" || !("endpoint" in value) || !("keys" in value)) return;
  const endpoint = pushEndpoint(value.endpoint);
  const keys = value.keys;
  if (!endpoint || !keys || typeof keys !== "object" || !("p256dh" in keys) || !("auth" in keys)) return;
  const validKey = (key: unknown, length: number) => {
    if (typeof key !== "string" || key.length > 100 || !/^[A-Za-z0-9_-]+$/.test(key)) return false;
    try {
      return decode64(key).length === length;
    } catch {
      return false;
    }
  };
  if (!validKey(keys.p256dh, 65) || !validKey(keys.auth, 16)) return;
  const p256dh = keys.p256dh as string;
  if (decode64(p256dh)[0] !== 4) return;
  return { endpoint, keys: { p256dh, auth: keys.auth as string } };
}
export function pushOpenHref(role: PushRole, conversation: string): string {
  return `/api/push/open?role=${role}&conversation=${encodeURIComponent(conversation)}`;
}
