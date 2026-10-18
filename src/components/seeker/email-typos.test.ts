import { describe, expect, it } from "vitest";
import { emailTypoFix } from "@/components/seeker/email-typos";

describe("a mistyped mail domain is offered its right spelling (#185)", () => {
  it("fixes the common services' typos, keeping the name", () => {
    expect(emailTypoFix("lin.wei@gmial.com")).toBe("lin.wei@gmail.com");
    expect(emailTypoFix("lin.wei@gmail.co")).toBe("lin.wei@gmail.com");
    expect(emailTypoFix("lin.wei@gmail.con")).toBe("lin.wei@gmail.com");
    expect(emailTypoFix("wang@hotmial.com")).toBe("wang@hotmail.com");
    expect(emailTypoFix("wang@outlok.com")).toBe("wang@outlook.com");
    expect(emailTypoFix("12345678@qq.con")).toBe("12345678@qq.com");
    expect(emailTypoFix("chen@163.cm")).toBe("chen@163.com");
    expect(emailTypoFix("chen@126.con")).toBe("chen@126.com");
    expect(emailTypoFix("zhao@iclould.com")).toBe("zhao@icloud.com");
    expect(emailTypoFix("zhao@yaho.com")).toBe("zhao@yahoo.com");
    expect(emailTypoFix("li@xtra.co.n")).toBe("li@xtra.co.nz");
  });

  it("reads the address the way sign-in does: case and spaces do not matter", () => {
    expect(emailTypoFix("  Lin.Wei@GMIAL.com ")).toBe("lin.wei@gmail.com");
  });

  it("leaves real services, right spellings and anything it does not know alone", () => {
    for (const address of [
      "a@gmail.com",
      "a@googlemail.com",
      "a@gmx.com",
      "a@mail.com",
      "a@yeah.net",
      "a@foxmail.com",
      "a@sina.com",
      "a@yahoo.co.nz",
      "a@xtra.co.nz",
      "a@hotmail.co.uk",
      "a@outlook.co.nz",
      "a@live.com",
      "a@me.com",
      "a@auckland.ac.nz",
      "a@example.com",
    ]) {
      expect(emailTypoFix(address), address).toBeNull();
    }
    expect(emailTypoFix("gmial.com")).toBeNull(); // no name
    expect(emailTypoFix("@gmial.com")).toBeNull();
    expect(emailTypoFix("")).toBeNull();
  });
});
