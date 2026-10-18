import { describe, expect, it } from "vitest";
import { signInCodeMail } from "@/lib/auth/delivery";

describe("the sign-in code email (Round 20)", () => {
  it("is written in the language of the request that asked for it, with the code and how long it works", () => {
    expect(signInCodeMail("123456")).toEqual({
      subject: "找工登录验证码：123456",
      text: expect.stringMatching(/^你的找工登录验证码是 123456，10 分钟内有效。/),
    });
    const en = signInCodeMail("123456", "en");
    expect(en.subject).toBe("Your 找工 sign-in code: 123456");
    expect(en.text).toMatch(/^Your 找工 sign-in code is 123456\. It works for 10 minutes\./);
    expect(en.text.replaceAll("找工", "")).not.toMatch(/[一-鿿]/u);
  });
});
