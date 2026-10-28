// RFC 8291 aes128gcm single-record payload + RFC 8292 VAPID. Web Crypto works on Node and Workers.
import { decode64, encode64, pushEndpoint, type BrowserSubscription } from "./rules";
import { isTestBuild } from "@/lib/test-build";
const bytes = (s: string) => new TextEncoder().encode(s);
const concat = (...parts: Uint8Array[]) => {
  const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};
async function hkdf(
  key: Uint8Array<ArrayBuffer>,
  salt: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  length: number,
) {
  const base = await crypto.subtle.importKey("raw", key, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, base, length * 8),
  );
}
export type VapidConfig = { publicKey: string; privateKey: string; subject: string };
export function vapidConfig(env: Record<string, string | undefined> = process.env): VapidConfig | undefined {
  const { PUSH_VAPID_PUBLIC_KEY: publicKey, PUSH_VAPID_PRIVATE_KEY: privateKey, PUSH_VAPID_SUBJECT: subject } = env;
  if (!publicKey || !privateKey || !subject || !/^(mailto:|https:\/\/)/.test(subject)) return;
  try {
    if (decode64(publicKey).length !== 65 || decode64(publicKey)[0] !== 4 || decode64(privateKey).length !== 32) return;
    return { publicKey, privateKey, subject };
  } catch {
    return;
  }
}
/** A malformed or mismatched key pair must not make the interface promise that push is available. */
export async function readyVapidConfig(
  env: Record<string, string | undefined> = process.env,
): Promise<VapidConfig | undefined> {
  const config = vapidConfig(env);
  if (!config) return;
  try {
    const authorization = await vapidAuthorization("https://fcm.googleapis.com/check", config);
    const token = authorization.slice("vapid t=".length).split(",")[0];
    const [header, claim, signature] = token.split(".");
    const key = await crypto.subtle.importKey(
      "raw",
      decode64(config.publicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    if (
      !(await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        decode64(signature),
        bytes(`${header}.${claim}`),
      ))
    )
      return;
    return config;
  } catch {
    return;
  }
}
export async function encryptPush(
  subscription: BrowserSubscription,
  payload: string,
): Promise<Uint8Array<ArrayBuffer>> {
  if (bytes(payload).length > 3000) throw new Error("Push payload too large");
  const ua = decode64(subscription.keys.p256dh);
  const peer = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const as = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: peer }, local.privateKey, 256));
  const ikm = await hkdf(shared, decode64(subscription.keys.auth), concat(bytes("WebPush: info\0"), ua, as), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await hkdf(ikm, salt, bytes("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(ikm, salt, bytes("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(bytes(payload), new Uint8Array([2]))),
  );
  // salt (16), record size (uint32 4096), key id length (65), application server public key, ciphertext.
  return concat(salt, new Uint8Array([0, 0, 16, 0, 65]), as, ciphertext);
}
export async function vapidAuthorization(endpoint: string, config: VapidConfig, now = Date.now()): Promise<string> {
  const pub = decode64(config.publicKey);
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: encode64(pub.slice(1, 33)), y: encode64(pub.slice(33)), d: config.privateKey },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = encode64(bytes(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claim = encode64(
    bytes(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 3600, sub: config.subject })),
  );
  const signed = `${header}.${claim}`;
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, bytes(signed));
  return `vapid t=${signed}.${encode64(new Uint8Array(signature))}, k=${config.publicKey}`;
}
/** One VAPID signature per push-service origin for one delivery (each token is valid for an hour, a delivery ≤ 20 s). */
export function vapidAuthorizer(config: VapidConfig, now = Date.now()): (endpoint: string) => Promise<string> {
  const byOrigin = new Map<string, Promise<string>>();
  return (endpoint) => {
    const origin = new URL(endpoint).origin;
    let authorization = byOrigin.get(origin);
    if (!authorization) byOrigin.set(origin, (authorization = vapidAuthorization(endpoint, config, now)));
    return authorization;
  };
}
export async function sendPush(
  subscription: BrowserSubscription,
  payload: string,
  config: VapidConfig,
  fetcher: typeof fetch = fetch,
  authorize: (endpoint: string) => Promise<string> = (endpoint) => vapidAuthorization(endpoint, config),
): Promise<"sent" | "expired" | "failed"> {
  // A ZG_E2E build must never send to real browser vendors. It still exercises real subscription authorization.
  // This switch is fixed at build time and is absent from deploy builds (ADR 0050).
  if (isTestBuild()) return "failed";
  if (!pushEndpoint(subscription.endpoint)) return "failed";
  const response = await fetcher(subscription.endpoint, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    headers: {
      Authorization: await authorize(subscription.endpoint),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "300",
      Urgency: "normal",
    },
    body: await encryptPush(subscription, payload),
  });
  await response.body?.cancel();
  return response.status === 404 || response.status === 410 ? "expired" : response.ok ? "sent" : "failed";
}
