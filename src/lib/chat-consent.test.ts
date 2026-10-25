import { expect, it } from "vitest";
import {
  requestExchange,
  respondExchange,
  visibleExchange,
  parseExchange,
  profilePayload,
  type Exchange,
} from "@/lib/chat-consent";
import { initialProfile } from "@/components/seeker/hub-state";
import { demoExchangeRequests } from "@/mock/chat-exchanges";

const payload = { title: "我的联系方式", fields: [{ label: "电话", value: "09 055 0001" }] };
const incoming: Exchange = {
  id: "x1",
  kind: "contact",
  from: "them",
  status: "pending",
  offered: payload,
  createdAt: "2026-10-13",
};

it("shows the asker's details as soon as the request arrives, and the reply only after the recipient agrees", () => {
  // The side that asks offers first: the recipient sees it at once, and has given nothing yet.
  expect(visibleExchange(incoming)).toEqual({ them: payload });
  expect(respondExchange(incoming, "them", "accepted", payload)).toBe(incoming);
  expect(respondExchange(incoming, "me", "accepted")).toBe(incoming);
  const accepted = respondExchange(incoming, "me", "accepted", { ...payload, title: "我的信息" });
  expect(visibleExchange(accepted)?.me?.title).toBe("我的信息");
  expect(visibleExchange(accepted)?.them?.title).toBe("我的联系方式");
  expect(respondExchange(accepted, "me", "rejected")).toBe(accepted);
});

it("a refusal gives nothing back, a withdrawn request is no longer shown, and only the asker can withdraw", () => {
  const rejected = respondExchange(incoming, "me", "rejected");
  expect(rejected.status).toBe("rejected");
  expect(visibleExchange(rejected)).toBeUndefined();
  expect(respondExchange(incoming, "me", "cancelled")).toBe(incoming);
  const withdrawn = respondExchange(incoming, "them", "cancelled");
  expect(withdrawn.status).toBe("cancelled");
  expect(visibleExchange(withdrawn)).toBeUndefined();
});

it("deduplicates pending or accepted exchanges and requires a valid payload", () => {
  expect(requestExchange([incoming], "contact", payload, "x2")).toEqual([incoming]);
  expect(requestExchange([], "contact", { ...payload, fields: [] }, "x2")).toEqual([]);
  const created = requestExchange([], "resume", payload, "x2");
  expect(created[0].from).toBe("me");
  // The asker sees what they offered; the other side's details come only with their agreement.
  expect(visibleExchange(created[0])).toEqual({ me: payload });
  expect(respondExchange(created[0], "me", "accepted", payload)).toBe(created[0]);
});

it("does not restore malformed accepted data as consent", () => {
  expect(parseExchange({ ...incoming, status: "accepted" })).toBeUndefined();
  expect(parseExchange({ ...incoming, status: "pending", response: payload })).toBeUndefined();
  expect(parseExchange({ ...incoming, kind: "other" })).toBeUndefined();
  // Address exchanges were removed (A24); old ones are dropped when read.
  expect(parseExchange({ ...incoming, kind: "address" })).toBeUndefined();
  const accepted = respondExchange(incoming, "me", "accepted", payload);
  expect(parseExchange(JSON.parse(JSON.stringify(accepted)))).toEqual(accepted);
});

it("keeps contact details out of resume exchanges and has no address to offer", () => {
  const profile = {
    ...initialProfile({ email: "seeker@example.com", signedInAt: "", activeRole: "seeker" }),
    privateDetails: { phone: "09 055 8888", wechat: "private", email: "" },
  };
  expect(profilePayload(profile, "contact", false)?.fields.map((field) => field.value)).toEqual([
    "09 055 8888",
    "private",
  ]);
  expect(JSON.stringify(profilePayload(profile, "resume", false))).not.toContain("private");
  expect(profilePayload(initialProfile(null), "contact", false)).toBeUndefined();
});

it("demo requests carry the asker's own details and never ask for an address", () => {
  const seeker = demoExchangeRequests(false);
  const employer = demoExchangeRequests(true);
  for (const requests of [seeker, employer])
    for (const item of Object.values(requests).flat()) {
      expect(["contact", "resume"]).toContain(item.kind);
      expect(item.from).toBe("them");
      expect(parseExchange(item)).toEqual(item);
    }
  expect(seeker["mt-eden"][0].offered.fields).toContainEqual({ label: "企业", value: "Mt Eden 餐馆" });
  expect(employer["candidate-chen"][0].offered.fields).toContainEqual({ label: "称呼", value: "陈雨" });
  expect(seeker["clean-home"]).toBeUndefined();
});

it("asked again after a refusal or a withdrawal, a conversation keeps at most three requests of a kind (#366)", () => {
  let items: Exchange[] = [];
  for (let i = 1; i <= 6; i++) {
    items = requestExchange(items, "contact", payload, `ask-${i}`);
    items = items.map((item) => (item.status === "pending" ? respondExchange(item, "me", "cancelled") : item));
  }
  expect(items.map((item) => item.id)).toEqual(["ask-4", "ask-5", "ask-6"]);
  // The other kind and the other side's refused request count for themselves; a pending one blocks a new one.
  const refused = respondExchange({ ...incoming, id: "theirs", kind: "resume" }, "me", "rejected");
  items = requestExchange([...items, refused], "contact", payload, "ask-7");
  expect(items.map((item) => item.id)).toEqual(["ask-5", "ask-6", "theirs", "ask-7"]);
  expect(requestExchange(items, "contact", payload, "ask-8")).toBe(items);
});
