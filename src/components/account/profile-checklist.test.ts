import { describe, expect, it } from "vitest";
import { initialProfile, type Profile } from "@/components/seeker/hub-state";
import { EMPTY_RESUME } from "@/lib/candidate-matching";
import { profileChecklist, profileProgress } from "./profile-checklist";

const seeker = initialProfile({ email: "a@b.co", signedInAt: "", activeRole: "seeker" });
const empty: Profile = {
  name: "",
  contactName: "",
  headline: "",
  location: "",
  languages: "",
  availability: "",
  bio: "",
};

describe("profileChecklist", () => {
  it("lists ten items for a job seeker, the five employers look at first marked key", () => {
    const items = profileChecklist(empty, false);
    expect(items).toHaveLength(10);
    expect(items.filter((item) => item.key).map((item) => item.label)).toEqual([
      "可上班时间",
      "地区",
      "期望时薪",
      "语言",
      "经验",
    ]);
  });

  it("counts the demo job seeker's filled fields and the resume", () => {
    expect(profileProgress(profileChecklist(seeker, false)).done).toBe(6);
    const withResume = {
      ...seeker,
      resume: { ...EMPTY_RESUME, expectedMinPay: 25, experienceYears: 0, skills: "收银" },
    };
    expect(profileProgress(profileChecklist(withResume, false)).done).toBe(9);
  });

  it("checks a business's verification, which comes from the server", () => {
    const business = { ...empty, name: "川味小馆", bio: "川菜馆", location: "Mt Eden", contactName: "陈经理" };
    const key = (v?: "unverified" | "business_verified") =>
      profileChecklist(business, true, v)
        .filter((item) => item.key && !item.done)
        .map((item) => item.label);
    expect(key()).toEqual(["企业验证"]);
    expect(key("unverified")).toEqual(["企业验证"]);
    expect(key("business_verified")).toEqual([]);
  });

  it("ignores whitespace-only answers", () => {
    const items = profileChecklist({ ...empty, bio: "   " }, false);
    expect(items.find((item) => item.id === "bio")?.done).toBe(false);
  });
});

describe("profileProgress", () => {
  it("puts missing key items first", () => {
    const { done, total, missing } = profileProgress(profileChecklist({ ...empty, name: "林晓" }, false));
    expect([done, total]).toEqual([1, 10]);
    expect(missing.slice(0, 5).every((item) => item.key)).toBe(true);
    expect(missing.at(-1)?.key).toBe(false);
  });
});
