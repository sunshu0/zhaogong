import { describe, expect, it } from "vitest";
import { incomingWarnings, outgoingWarning, sentWarningParts } from "@/components/seeker/chat-warnings";

describe("chat compliance reminders", () => {
  it("warns under a received message that asks for fees, sells visas or picks by ethnicity, with a report reason", () => {
    expect(incomingWarnings("入职前先交押金 500")).toEqual([
      {
        rule: "fee",
        text: "找工不允许向求职者收取押金或任何费用。请谨慎，不要先付钱；可以举报。",
        reportReason: "fees",
      },
    ]);
    expect(incomingWarnings("我们包工签，只招华人").map((w) => [w.rule, w.reportReason])).toEqual([
      ["visa_selling", "illegal"],
      ["ethnic_preference", "discrimination"],
    ]);
  });

  it("says nothing for an ordinary message or a negation", () => {
    expect(incomingWarnings("今天下午方便面谈吗？")).toEqual([]);
    expect(incomingWarnings("我们不收押金，也不包签")).toEqual([]);
  });

  it("asks the sender to change their own message, naming the words, without blocking it", () => {
    expect(outgoingWarning("先交押金再上班")).toBe(
      "这条消息提到「押金」：找工不允许向求职者收取押金或任何费用，建议修改后再发。",
    );
    expect(outgoingWarning("你好")).toBeUndefined();
  });

  it("tells the sender of a message already sent that the other side sees a reminder (#384)", () => {
    expect(sentWarningParts("先交押金再上班")).toEqual({
      before: "这条消息提到",
      words: "「押金」",
      after: "：找工不允许向求职者收取押金或任何费用。对方会看到一条提醒。",
    });
    expect(sentWarningParts("Pay a deposit first", "en")?.after).toBe(
      ": 找工 does not allow asking job seekers for a deposit or any fee. The other person sees a reminder.",
    );
    expect(sentWarningParts("我们不收押金")).toBeUndefined();
  });

  it("warns about task scams and offers 诈骗 as the report reason (#384)", () => {
    expect(incomingWarnings("在家刷单，日结")).toEqual([
      {
        rule: "task_scam",
        text: "找工不允许用刷单、刷好评、垫付返利这类「任务」招人。这类往往是诈骗：不要先垫钱；可以举报。",
        reportReason: "fraud",
      },
    ]);
  });
});
