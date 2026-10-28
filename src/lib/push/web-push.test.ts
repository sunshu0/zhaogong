import { createECDH, createDecipheriv, createPublicKey, hkdfSync, verify } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decode64, encode64 } from "./rules";
import { encryptPush, readyVapidConfig, sendPush, vapidAuthorization, type VapidConfig } from "./web-push";

async function vapid(): Promise<VapidConfig> {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const privateKey = await crypto.subtle.exportKey("jwk", keys.privateKey);
  return {
    publicKey: encode64(new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey))),
    privateKey: privateKey.d!,
    subject: "mailto:push@example.com",
  };
}
function receiver() {
  const key = createECDH("prime256v1");
  key.generateKeys();
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    key,
    auth,
    subscription: {
      endpoint: "https://fcm.googleapis.com/fcm/send/test",
      keys: { p256dh: encode64(key.getPublicKey()), auth: encode64(auth) },
    },
  };
}
afterEach(() => vi.unstubAllEnvs());
describe("Web Push wire protocol", () => {
  it("never sends to a real vendor in a browser-test build", async () => {
    vi.stubEnv("ZG_E2E", "1");
    const fetcher = vi.fn<typeof fetch>();
    expect(await sendPush(receiver().subscription, "generic", await vapid(), fetcher)).toBe("failed");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("can be decrypted by an independent Node ECDH/HKDF/AES-GCM receiver (RFC8291)", async () => {
    const { key, auth, subscription } = receiver();
    const payload = JSON.stringify({ title: "找工", body: "有新消息", url: "/api/push/open?role=seeker" });
    const wire = Buffer.from(await encryptPush(subscription, payload));
    expect(wire.readUInt32BE(16)).toBe(4096);
    expect(wire[20]).toBe(65);
    const salt = wire.subarray(0, 16),
      as = wire.subarray(21, 86),
      ciphertext = wire.subarray(86);
    const shared = key.computeSecret(as);
    const ikm = hkdfSync(
      "sha256",
      shared,
      auth,
      Buffer.concat([Buffer.from("WebPush: info\0"), key.getPublicKey(), as]),
      32,
    );
    const cek = hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
    const nonce = hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12);
    const decipher = createDecipheriv("aes-128-gcm", Buffer.from(cek), Buffer.from(nonce));
    decipher.setAuthTag(ciphertext.subarray(-16));
    const plain = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]);
    expect(plain.at(-1)).toBe(2);
    expect(plain.subarray(0, -1).toString()).toBe(payload);
  });
  it("produces a VAPID JWT independently verifiable with ES256 and bounded origin/expiry", async () => {
    const config = await vapid();
    const now = Date.parse("2026-10-28T09:00:00Z");
    const header = await vapidAuthorization("https://web.push.apple.com/test", config, now);
    const token = header.slice(8).split(",")[0];
    const [head, body, signature] = token.split(".");
    expect(JSON.parse(Buffer.from(decode64(head)).toString())).toEqual({ typ: "JWT", alg: "ES256" });
    expect(JSON.parse(Buffer.from(decode64(body)).toString())).toEqual({
      aud: "https://web.push.apple.com",
      exp: now / 1000 + 3600,
      sub: config.subject,
    });
    const point = decode64(config.publicKey);
    const key = createPublicKey({
      key: { kty: "EC", crv: "P-256", x: encode64(point.slice(1, 33)), y: encode64(point.slice(33)) },
      format: "jwk",
    });
    expect(
      verify("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" }, decode64(signature)),
    ).toBe(true);
  });
  it("treats malformed and mismatched deployment keys as unavailable", async () => {
    expect(await readyVapidConfig({})).toBeUndefined();
    const a = await vapid(),
      b = await vapid();
    const env = {
      PUSH_VAPID_PUBLIC_KEY: a.publicKey,
      PUSH_VAPID_PRIVATE_KEY: a.privateKey,
      PUSH_VAPID_SUBJECT: a.subject,
    };
    expect(await readyVapidConfig(env)).toEqual(a);
    expect(await readyVapidConfig({ ...env, PUSH_VAPID_PRIVATE_KEY: b.privateKey })).toBeUndefined();
    expect(await readyVapidConfig({ ...env, PUSH_VAPID_PUBLIC_KEY: encode64(new Uint8Array(65)) })).toBeUndefined();
  });
  it("uses encrypted POST, rejects redirects and classifies expired endpoints without leaking response bodies", async () => {
    const config = await vapid(),
      { subscription } = receiver();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 410 }));
    expect(await sendPush(subscription, "new message", config, fetcher)).toBe("expired");
    expect(fetcher).toHaveBeenCalledWith(
      subscription.endpoint,
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        body: expect.any(Uint8Array),
        headers: expect.objectContaining({ TTL: "300", "Content-Encoding": "aes128gcm" }),
      }),
    );
    fetcher.mockClear();
    expect(await sendPush({ ...subscription, endpoint: "https://127.0.0.1/secret" }, "x", config, fetcher)).toBe(
      "failed",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
