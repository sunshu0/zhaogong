import { describe, expect, it } from "vitest";
import { encode64, parseSubscription, pushEndpoint, pushOpenHref } from "./rules";
describe("browser push boundaries", () => {
  it("never accepts an arbitrary URL, credentials, local addresses or non-default ports", () => {
    for (const url of [
      "http://fcm.googleapis.com/a",
      "https://127.0.0.1/a",
      "https://fcm.googleapis.com.evil.test/a",
      "https://user@web.push.apple.com/a",
      "https://fcm.googleapis.com:444/a",
      "https://fcm.googleapis.com/a#token",
      "https://example.com/a",
    ])
      expect(pushEndpoint(url)).toBeUndefined();
    expect(pushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe("https://fcm.googleapis.com/fcm/send/abc");
  });
  it("requires actual browser key sizes and a P-256 point marker", () => {
    const key = new Uint8Array(65);
    key[0] = 4;
    const value = {
      endpoint: "https://web.push.apple.com/abc",
      keys: { p256dh: encode64(key), auth: encode64(new Uint8Array(16)) },
    };
    expect(parseSubscription(value)).toEqual(value);
    expect(parseSubscription({ ...value, keys: { ...value.keys, auth: "x" } })).toBeUndefined();
    expect(
      parseSubscription({ ...value, keys: { ...value.keys, p256dh: encode64(new Uint8Array(65)) } }),
    ).toBeUndefined();
  });
  it("encodes only the intended chat and role into a same-origin click", () => {
    expect(pushOpenHref("employer", "shared:x&evil=1")).toBe(
      "/api/push/open?role=employer&conversation=shared%3Ax%26evil%3D1",
    );
  });
});
