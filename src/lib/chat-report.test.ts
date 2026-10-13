import { expect, it } from "vitest";
import { parseChatReport } from "@/lib/chat-report";

const report = { id: "r1", conversationId: "thread", targetName: "对方", targetRole: "employer", reason: "fraud", note: "", evidence: [{ from: "them", text: "先交钱", time: "刚刚" }], createdAt: "2026-10-13", messageIndex: 0 };
it("captures the reported party and evidence without accepting invalid reports", () => {
  expect(parseChatReport(report)).toEqual(report);
  expect(parseChatReport({ ...report, targetRole: "seeker" })?.targetRole).toBe("seeker");
  for (const patch of [{ reason: "unknown" }, { reason: "other" }, { note: "x".repeat(1001) }, { messageIndex: -1 }, { evidence: [{ text: "no sender" }] }]) {
    expect(parseChatReport({ ...report, ...patch })).toBeUndefined();
  }
});
