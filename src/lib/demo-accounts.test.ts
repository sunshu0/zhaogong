import { describe, expect, it } from "vitest";
import { isDemoAccount } from "@/lib/demo-accounts";
import { chatDemo } from "@/components/seeker/chat-demo";
import { initialNotifications } from "@/components/seeker/hub-state";

describe("demo accounts (#110)", () => {
  it("are the fixed demo addresses and example.com addresses starting with demo.", () => {
    for (const email of [
      "seeker@example.com",
      "boss@example.com",
      "moderator@example.com",
      " Demo.Chat.1@Example.com ",
    ])
      expect(isDemoAccount(email), email).toBe(true);
    for (const email of ["li@example.com", "demo.li@gmail.com", "mydemo.li@example.com", "demo@example.com", "", null])
      expect(isDemoAccount(email), String(email)).toBe(false);
  });

  it("alone see the demo's made-up chats and notifications", () => {
    expect(chatDemo(false, true).conversations.map((c) => c.person)).toContain("北岸早茶酒家");
    expect(chatDemo(true, true).conversations.map((c) => c.person)).toContain("林晓");
    for (const isEmployer of [false, true])
      expect(chatDemo(isEmployer, false)).toEqual({ conversations: [], messages: {}, unread: {}, exchanges: {} });

    const session = { signedInAt: "", employerId: "e1", employerName: "川味小馆" };
    for (const activeRole of ["seeker", "employer"] as const) {
      expect(initialNotifications({ ...session, activeRole, email: "boss@example.com" })).toHaveLength(3);
      expect(initialNotifications({ ...session, activeRole, email: "new.person@example.com" })).toEqual([]);
    }
    expect(initialNotifications(null)).toEqual([]);
  });
});
