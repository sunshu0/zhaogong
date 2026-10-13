import { expect, it } from "vitest";
import { requestExchange, respondExchange, visibleExchange, parseExchange, profilePayload, type Exchange } from "@/lib/chat-consent";
import { initialProfile } from "@/components/seeker/hub-state";

const payload = { title: "我的联系方式", fields: [{ label: "电话", value: "021 555 0001" }] };
const incoming: Exchange = { id: "x1", kind: "contact", from: "them", status: "pending", offered: payload, createdAt: "2026-10-13" };

it("reveals both sides only after the recipient agrees with their own information", () => {
  expect(visibleExchange(incoming)).toBeUndefined();
  expect(respondExchange(incoming, "them", "accepted", payload)).toBe(incoming);
  expect(respondExchange(incoming, "me", "accepted")).toBe(incoming);
  const accepted = respondExchange(incoming, "me", "accepted", { ...payload, title: "我的信息" });
  expect(visibleExchange(accepted)?.me.title).toBe("我的信息");
  expect(visibleExchange(accepted)?.them.title).toBe("我的联系方式");
  expect(respondExchange(accepted, "me", "rejected")).toBe(accepted);
});

it("never reveals information on refusal or cancellation, and only the sender can cancel", () => {
  const rejected = respondExchange(incoming, "me", "rejected");
  expect(rejected.status).toBe("rejected");
  expect(visibleExchange(rejected)).toBeUndefined();
  expect(respondExchange(incoming, "me", "cancelled")).toBe(incoming);
  expect(respondExchange(incoming, "them", "cancelled").status).toBe("cancelled");
});

it("deduplicates pending or accepted exchanges and requires a valid payload", () => {
  expect(requestExchange([incoming], "contact", payload, "x2")).toEqual([incoming]);
  expect(requestExchange([], "contact", { ...payload, fields: [] }, "x2")).toEqual([]);
  const created = requestExchange([], "address", payload, "x2");
  expect(created[0].from).toBe("me");
  expect(visibleExchange(created[0])).toBeUndefined();
  expect(respondExchange(created[0], "me", "accepted", payload)).toBe(created[0]);
});

it("does not restore malformed accepted data as consent", () => {
  expect(parseExchange({ ...incoming, status: "accepted" })).toBeUndefined();
  expect(parseExchange({ ...incoming, status: "pending", response: payload })).toBeUndefined();
  expect(parseExchange({ ...incoming, kind: "other" })).toBeUndefined();
  const accepted = respondExchange(incoming, "me", "accepted", payload);
  expect(parseExchange(JSON.parse(JSON.stringify(accepted)))).toEqual(accepted);
});

it("keeps contact and address out of resume exchanges and never substitutes public location for a private address", () => {
  const profile = { ...initialProfile(null), privateDetails: { phone: "021 555 8888", wechat: "private", email: "", address: "private location" } };
  expect(profilePayload(profile, "contact", false)?.fields.map((field) => field.value)).toEqual(["021 555 8888", "private"]);
  expect(profilePayload(profile, "address", false)?.fields).toEqual([{ label: "地址", value: "private location" }]);
  expect(JSON.stringify(profilePayload(profile, "resume", false))).not.toContain("private");
  expect(profilePayload(initialProfile(null), "contact", false)).toBeUndefined();
  expect(profilePayload(initialProfile(null), "address", false)).toBeUndefined();
});
