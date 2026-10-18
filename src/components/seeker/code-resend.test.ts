import { describe, expect, it } from "vitest";
import { resendLabel, secondsLeft } from "@/components/seeker/code-resend";

describe("重新获取验证码 counted down (#184)", () => {
  const sent = Date.parse("2026-10-18T03:00:00.000Z");
  const resendAt = sent + 60_000;

  it("counts whole seconds up, so the button never opens early, and stops at 0", () => {
    expect(secondsLeft(resendAt, sent)).toBe(60);
    expect(secondsLeft(resendAt, sent + 400)).toBe(60);
    expect(secondsLeft(resendAt, sent + 59_001)).toBe(1);
    expect(secondsLeft(resendAt, sent + 60_000)).toBe(0);
    expect(secondsLeft(resendAt, sent + 90_000)).toBe(0);
    expect(secondsLeft(0, sent)).toBe(0); // no code asked for yet
  });

  it("says how long is left, then offers a new code", () => {
    expect(resendLabel(42)).toBe("42 秒后可重新获取");
    expect(resendLabel(1)).toBe("1 秒后可重新获取");
    expect(resendLabel(0)).toBe("重新获取验证码");
  });

  it("says it in English on an English page (Round 20)", () => {
    expect(resendLabel(42, "en")).toBe("New code in 42 s");
    expect(resendLabel(0, "en")).toBe("Send a new code");
  });
});
