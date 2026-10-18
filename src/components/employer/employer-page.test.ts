import { describe, expect, it } from "vitest";
import {
  canEditPage,
  pagePart,
  parseEmployerPage,
  personalPart,
  publicPage,
  readOnlyNote,
  touchesPage,
} from "@/components/employer/employer-page";

const PHOTO = `data:image/png;base64,${"A".repeat(40)}`;

describe("the business's part of a page (ADR 0022)", () => {
  it("keeps the public fields and leaves the person's 私密交换资料 to the browser", () => {
    const page = {
      name: "川味小馆",
      bio: "家常川菜",
      avatar: PHOTO,
      privateDetails: { phone: "021 000 0000", wechat: "wx", email: "boss@example.com" },
    };
    expect(pagePart(page)).toEqual({ name: "川味小馆", bio: "家常川菜", avatar: PHOTO });
    expect(personalPart(page)).toEqual({ privateDetails: page.privateDetails });
    expect(pagePart(undefined)).toEqual({});
  });

  it("tells a change of the page from a change of one's own details", () => {
    expect(touchesPage({ headline: "招前厅" })).toBe(true);
    expect(touchesPage({ privateDetails: { phone: "1", wechat: "", email: "" } })).toBe(false);
  });
});

describe("parseEmployerPage", () => {
  it("checks each field like a 我的主页 and drops what is not the business's", () => {
    expect(
      parseEmployerPage({
        name: "川味小馆",
        headline: 7,
        avatar: "javascript:alert(1)",
        resume: { skills: "炒锅" },
        privateDetails: { phone: "021" },
      }),
    ).toEqual({ name: "川味小馆" });
  });

  it("is undefined for something that is not a page, or larger than the editor can make", () => {
    expect(parseEmployerPage("page")).toBeUndefined();
    expect(parseEmployerPage([{ name: "x" }])).toBeUndefined();
    expect(parseEmployerPage({ bio: "长".repeat(260_000) })).toBeUndefined();
  });
});

describe("publicPage", () => {
  it("uses the business's name until the page gives one, and empty text for the rest", () => {
    expect(publicPage("川味小馆", { bio: "家常川菜" })).toEqual({
      name: "川味小馆",
      headline: "",
      location: "",
      languages: "",
      availability: "",
      bio: "家常川菜",
      contactName: "",
    });
    expect(publicPage("川味小馆", { name: "川味小馆 · 北岸店", avatar: PHOTO })).toMatchObject({
      name: "川味小馆 · 北岸店",
      avatar: PHOTO,
    });
    expect(publicPage("川味小馆", { name: "  " }).name).toBe("川味小馆");
  });
});

describe("who changes the page", () => {
  it("is an admin; a member is told who can", () => {
    expect(canEditPage("admin")).toBe(true);
    expect(canEditPage("member")).toBe(false);
    expect(canEditPage(undefined)).toBe(false);
    expect(readOnlyNote(["王老板", "lee@example.com"])).toContain("管理员（王老板、lee@example.com）能改");
    expect(readOnlyNote([])).toContain("只有管理员能改");
  });
});
