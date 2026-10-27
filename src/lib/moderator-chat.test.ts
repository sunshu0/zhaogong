import { describe, expect, it } from "vitest";
import { moderatorChatText, moderatorChatView, MODERATOR_CHAT_TEXT_MAX } from "@/lib/moderator-chat";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";

const chat = {
  employerId: "e9",
  employerReadAt: "2026-10-27T01:05:00.000Z",
  moderatorsReadAt: "2026-10-27T01:00:00.000Z",
};
const rows = [
  {
    id: 1,
    from: "moderator" as const,
    senderEmail: "mod@example.com",
    byName: null,
    text: "请补一张营业执照",
    sentAt: "2026-10-27T01:00:00.000Z",
  },
  {
    id: 2,
    from: "employer" as const,
    senderEmail: "boss@example.com",
    byName: "王经理",
    text: "好的，今天补",
    sentAt: "2026-10-27T01:04:00.000Z",
  },
  {
    id: 3,
    from: "moderator" as const,
    senderEmail: DELETED_ACCOUNT,
    byName: null,
    text: "收到",
    sentAt: "2026-10-27T01:06:00.000Z",
  },
];

describe("moderatorChatView (#407, ADR 0046)", () => {
  it("never tells the business which moderator wrote; shows the team's names and what the moderators read", () => {
    const view = moderatorChatView("employer", chat, "测试店", rows);
    expect(view.lines).toEqual([
      { id: 1, mine: false, text: "请补一张营业执照", sentAt: rows[0].sentAt },
      { id: 2, mine: true, text: "好的，今天补", sentAt: rows[1].sentAt, by: "王经理", read: false },
      { id: 3, mine: false, text: "收到", sentAt: rows[2].sentAt },
    ]);
    expect(JSON.stringify(view)).not.toContain("example.com");
    expect(view.unread).toBe(1); // 收到, after the team read at 01:05
  });

  it("shows the moderators who wrote, a deleted one by the words given, and the business's unread replies", () => {
    const view = moderatorChatView("moderator", chat, "测试店", rows, "已删除的审核员");
    expect(view.lines.map((line) => [line.mine, line.by, line.read])).toEqual([
      [true, "mod@example.com", true],
      [false, "王经理", undefined],
      [true, "已删除的审核员", false],
    ]);
    expect(view.unread).toBe(1); // 好的，今天补, after the moderators read at 01:00
  });
});

describe("moderatorChatText", () => {
  it("trims, and refuses nothing and too much", () => {
    expect(moderatorChatText("  你好 ")).toEqual({ ok: true, text: "你好" });
    expect(moderatorChatText("   ")).toEqual({ ok: false, reason: "empty" });
    expect(moderatorChatText(42)).toEqual({ ok: false, reason: "empty" });
    expect(moderatorChatText("字".repeat(MODERATOR_CHAT_TEXT_MAX + 1))).toEqual({ ok: false, reason: "long" });
  });
});
