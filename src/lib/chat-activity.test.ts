import { describe, expect, it } from "vitest";
import {
  aucklandDay,
  countRepliedCandidates,
  lastActiveLabel,
  messageReadLabel,
  validTimestamp,
} from "@/lib/chat-activity";
import type { Conversation, Message } from "@/components/seeker/chat-client";

const now = Date.parse("2026-10-12T11:05:00Z");
const sentAt = "2026-10-12T11:01:00Z";
const incoming: Message = { from: "them", text: "你好", time: "昨天" };
const reply: Message = { from: "me", text: "欢迎面试", time: "刚刚", sentAt };
const conversation = (id: string, candidateId?: string): Conversation => ({
  id,
  candidateId,
  person: "候选人",
  title: "服务员",
  job: "j1",
  time: "刚刚",
  avatar: "人",
});

describe("chat activity", () => {
  it("only explicit receipts show read; legacy outgoing messages stay unknown", () => {
    expect(messageReadLabel(reply)).toBe("未读");
    expect(messageReadLabel({ ...reply, readAt: sentAt })).toBe("已读");
    expect(messageReadLabel({ ...reply, sentAt: undefined })).toBe("阅读状态未知");
    expect(messageReadLabel(incoming)).toBe("我未读");
    expect(messageReadLabel({ ...incoming, readAt: sentAt })).toBe("我已读");
  });

  it("formats approximate last activity without inferring current online state", () => {
    expect(lastActiveLabel(undefined, now)).toBe("最近上线时间未知");
    expect(lastActiveLabel("bad", now)).toBe("最近上线时间未知");
    for (const [minutes, label] of [
      [0, "刚刚在线"],
      [5, "约 5 分钟前在线"],
      [119, "约 1 小时前在线"],
      [1440, "约 1 天前在线"],
      [10080, "一周前在线"],
    ] as const) {
      expect(lastActiveLabel(new Date(now - minutes * 60_000).toISOString(), now)).toBe(label);
    }
    expect(lastActiveLabel(new Date(now + 60_000).toISOString(), now)).toBe("刚刚在线");
    expect(validTimestamp(1)).toBe(false);
    expect(validTimestamp("昨天")).toBe(false);
  });

  it("counts unique people across jobs and uses Auckland midnight rather than UTC midnight", () => {
    expect(aucklandDay(now)).not.toBe(aucklandDay(Date.parse("2026-10-12T10:59:00Z")));
    const conversations = [
      conversation("candidate-lin"),
      conversation("recommend:candidate-lin:j2"),
      conversation("candidate-chen"),
      conversation("candidate-wang"),
      conversation("candidate-zhao"),
      conversation("candidate-li"),
      conversation("candidate-su"),
    ];
    expect(
      countRepliedCandidates(
        conversations,
        {
          "candidate-lin": [incoming, reply, reply],
          "recommend:candidate-lin:j2": [incoming, reply],
          "candidate-chen": [incoming, { ...reply, sentAt: "2026-10-12T10:59:00Z" }],
          "candidate-wang": [reply, incoming],
          "candidate-zhao": [incoming, { ...reply, sentAt: undefined }],
          "candidate-li": [incoming, { ...reply, sentAt: "2026-10-12T11:06:00Z" }],
          "candidate-su": [incoming, reply],
        },
        now,
      ),
    ).toBe(2);
    expect(
      countRepliedCandidates(
        [conversation("recommend:old:j1", "local-person"), conversation("recommend:new:j2", "local-person")],
        {
          "recommend:old:j1": [incoming, reply],
          "recommend:new:j2": [incoming, reply],
        },
        now,
      ),
    ).toBe(1);
  });
});
