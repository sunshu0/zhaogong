import { describe, expect, it } from "vitest";
import {
  SAVED_STAGE_LABELS,
  SAVED_STAGES,
  effectiveStage,
  jobsContactedInChat,
  parseSavedStage,
  saveAfterSignInHref,
} from "@/components/seeker/saved-jobs";
import type { Exchange } from "@/lib/chat-consent";

const exchange = (kind: Exchange["kind"], status: Exchange["status"]): Exchange => ({
  id: `${kind}-${status}`,
  kind,
  from: "me",
  status,
  offered: { title: "联系方式", fields: [] },
  createdAt: "2026-10-16T00:00:00.000Z",
});
const conversation = (id: string, job: string | null) => ({
  id,
  person: "某店",
  title: "职位",
  time: "",
  avatar: "某",
  job,
});

describe("saved job stages", () => {
  it("go 已收藏 → 已联系 → 已面试 → 已录用 / 没成", () => {
    expect(SAVED_STAGES.map((s) => SAVED_STAGE_LABELS[s])).toEqual(["已收藏", "已联系", "已面试", "已录用", "没成"]);
    expect(parseSavedStage("interviewed")).toBe("interviewed");
    expect(parseSavedStage("offer")).toBeUndefined();
    expect(parseSavedStage(null)).toBeUndefined();
  });

  it("show what the user picked; until then 已联系 once the chat swapped contact details", () => {
    expect(effectiveStage(null, false)).toBe("saved");
    expect(effectiveStage(null, true)).toBe("contacted");
    expect(effectiveStage("saved", true)).toBe("saved"); // the user set it back
    expect(effectiveStage("hired", false)).toBe("hired");
  });
});

describe("jobsContactedInChat", () => {
  it("counts only an agreed contact-details exchange in a chat about the job", () => {
    const view = {
      conversations: [
        conversation("a", "j1"),
        conversation("b", "j2"),
        conversation("c", "j3"),
        conversation("d", null),
      ],
      exchanges: {
        a: [exchange("contact", "pending"), exchange("contact", "accepted")],
        b: [exchange("resume", "accepted")],
        c: [exchange("contact", "rejected")],
        d: [exchange("contact", "accepted")],
      },
    };
    expect([...jobsContactedInChat(view)]).toEqual(["j1"]);
  });
});

describe("saveAfterSignInHref", () => {
  it("signs in, then comes back to the same page with the job to save, keeping its query", () => {
    expect(saveAfterSignInHref("/jobs/j3", "j3")).toBe("/login?next=%2Fjobs%2Fj3%3Fsave%3Dj3");
    expect(saveAfterSignInHref("/jobs?meals=1&q=厨师", "j5")).toBe(
      `/login?next=${encodeURIComponent("/jobs?meals=1&q=%E5%8E%A8%E5%B8%88&save=j5")}`,
    );
  });
});
