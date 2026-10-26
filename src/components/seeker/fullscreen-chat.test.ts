import { describe, expect, it } from "vitest";
import { backReachesList, conversationAddress } from "@/components/seeker/fullscreen-chat";

describe("full-screen chat on phones (T1, ADR 0042)", () => {
  it("puts the open conversation in the address and takes it out again, other parameters kept", () => {
    expect(conversationAddress({ pathname: "/messages", search: "" }, "chat:12")).toBe(
      "/messages?conversation=chat%3A12",
    );
    expect(conversationAddress({ pathname: "/messages", search: "?conversation=a" }, "b")).toBe(
      "/messages?conversation=b",
    );
    expect(conversationAddress({ pathname: "/messages", search: "?conversation=a" }, null)).toBe("/messages");
    expect(conversationAddress({ pathname: "/messages", search: "?x=1&conversation=a" }, null)).toBe("/messages?x=1");
  });

  it("goes back in the history to the list only from the entry it pushed", () => {
    const pushed = { href: "https://zhaogong.test/messages?conversation=a", length: 4 };
    expect(backReachesList(pushed, { ...pushed })).toBe(true);
    // Opened by a link from another page, or after a reload: nothing was pushed here.
    expect(backReachesList(null, pushed)).toBe(false);
    // Another conversation opened from elsewhere, or the same one reached again by a later navigation.
    expect(backReachesList(pushed, { ...pushed, href: "https://zhaogong.test/messages?conversation=b" })).toBe(false);
    expect(backReachesList(pushed, { ...pushed, length: 6 })).toBe(false);
  });
});
