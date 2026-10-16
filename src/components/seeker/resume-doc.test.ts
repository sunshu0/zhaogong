import { describe, expect, it } from "vitest";
import { parseProfilePatch } from "@/components/seeker/hub-state";
import {
  contactRows,
  missingEnglish,
  parseContactChoice,
  parseEnglish,
  parseResumeDoc,
  parseWorkRights,
  resumeDocFrom,
  resumeRows,
  shareCopy,
  workRightsText,
  type ResumeSource,
} from "@/components/seeker/resume-doc";

const source: ResumeSource = {
  name: "林晓",
  headline: "前厅服务 · 中英文沟通",
  location: "奥克兰 · 北岸",
  languages: "普通话、英语",
  availability: "周一至周六",
  bio: "有餐饮服务经验。",
  resume: {
    candidateId: "c-1",
    discoverable: true,
    skills: "点单、收银",
    experienceYears: 2,
    employmentTypes: ["part_time", "casual"],
    regionIds: [],
    hoursPerWeek: { min: 20, max: 30 },
    expectedMinPay: 25,
  },
  english: { name: "Xiao Lin", languages: "Mandarin, English" },
  workRights: { visa: "student", weeklyHours: 25 },
  resumeContact: { phone: true, wechat: false, email: true },
  privateDetails: { phone: " 09 023 4567 ", wechat: "linxiao", email: "lin@example.com" },
};

describe("中英文简历 (#86)", () => {
  it("prints each fact in Chinese with the English the person wrote, and fixed values in both languages", () => {
    const rows = resumeRows(resumeDocFrom(source));
    expect(rows.map((r) => [r.id, r.zh, r.en])).toEqual([
      ["availability", "周一至周六 · 每周 20–30 小时 · 兼职、临时工", "20–30 hours a week · Part-time, Casual"],
      ["location", "奥克兰 · 北岸", ""],
      ["pay", "NZ$25 / 小时起", "From NZ$25 an hour"],
      ["languages", "普通话、英语", "Mandarin, English"],
      ["experience", "2 年", "2 years"],
      ["skills", "点单、收银", ""],
      ["visa", "持学签，每周可工作 25 小时", "Student visa; may work up to 25 hours a week"],
      ["bio", "有餐饮服务经验。", ""],
    ]);
  });

  it("lists the fields still missing their English, and never makes the English up", () => {
    const doc = resumeDocFrom(source);
    expect(missingEnglish(doc)).toEqual(["headline", "location", "availability", "skills", "bio"]);
    expect(doc.en.bio).toBe("");
    // With regions chosen, the location has English names already.
    const withRegions = resumeDocFrom({ ...source, resume: { ...source.resume!, regionIds: ["akl-cbd"] } });
    expect(missingEnglish(withRegions)).not.toContain("location");
    expect(resumeRows(withRegions).find((r) => r.id === "location")).toMatchObject({
      zh: "市中心",
      en: "Auckland CBD",
    });
  });

  it("leaves out rows with nothing in Chinese, and English written for an empty Chinese field", () => {
    const doc = resumeDocFrom({
      ...source,
      bio: "",
      english: { bio: "Hello" },
      resume: undefined,
      workRights: undefined,
    });
    expect(resumeRows(doc).map((r) => r.id)).toEqual(["availability", "location", "languages"]);
    expect(missingEnglish(doc)).not.toContain("bio");
    expect(resumeRows(resumeDocFrom({ ...source, resume: { ...source.resume!, experienceYears: 0 } }))).toContainEqual(
      expect.objectContaining({ id: "experience", zh: "无经验", en: "No experience yet" }),
    );
  });

  it("states the visa as the person gave it: no hours for citizens and residents", () => {
    expect(workRightsText({ visa: "citizen_resident" })).toEqual({ zh: "公民 / 永居", en: "Citizen / resident" });
    expect(parseWorkRights({ visa: "citizen_resident", weeklyHours: 20 })).toEqual({ visa: "citizen_resident" });
    expect(parseWorkRights({ visa: "open_work", weeklyHours: 0 })).toEqual({ visa: "open_work" });
    expect(parseWorkRights({ visa: "student", weeklyHours: 25 })).toEqual({ visa: "student", weeklyHours: 25 });
    expect(parseWorkRights({ visa: "tourist" })).toBeUndefined();
    expect(parseWorkRights("student")).toBeUndefined();
  });

  it("puts on the page only the contact details ticked and filled in", () => {
    const doc = resumeDocFrom(source);
    expect(doc.contact).toEqual({ phone: "09 023 4567", email: "lin@example.com" });
    expect(contactRows(doc.contact).map((r) => r.id)).toEqual(["phone", "email"]);
    expect(resumeDocFrom({ ...source, resumeContact: undefined }).contact).toEqual({});
    expect(parseContactChoice({ phone: true, wechat: "yes" })).toEqual({ phone: true, wechat: false, email: false });
  });

  it("shares without the email, and the server drops an email a browser sends anyway", () => {
    const shared = shareCopy(resumeDocFrom(source));
    expect(shared.contact).toEqual({ phone: "09 023 4567" });
    const parsed = parseResumeDoc({ ...resumeDocFrom(source), contact: { phone: "1", email: "x@example.com" } });
    expect(parsed?.contact).toEqual({ phone: "1" });
  });

  it("parses what a browser sends: needs a name, trims and caps the text, keeps only known facts", () => {
    expect(parseResumeDoc(null)).toBeNull();
    expect(parseResumeDoc({ zh: { name: "  " } })).toBeNull();
    const parsed = parseResumeDoc({
      zh: { name: " 林晓 ", bio: "长".repeat(700), extra: "x" },
      en: { name: 5 },
      facts: { employmentTypes: ["part_time", "boss"], regionIds: ["akl-cbd", "mars"], expectedMinPay: 999 },
      workRights: { visa: "working_holiday", weeklyHours: 40 },
    });
    expect(parsed?.zh.name).toBe("林晓");
    expect([...parsed!.zh.bio]).toHaveLength(600);
    expect(parsed?.en.name).toBe("");
    expect(parsed?.facts).toEqual({
      employmentTypes: ["part_time"],
      regionIds: ["akl-cbd"],
      experienceYears: undefined,
      hoursPerWeek: undefined,
      expectedMinPay: undefined,
    });
    expect(parsed?.workRights).toEqual({ visa: "working_holiday", weeklyHours: 40 });
  });

  it("keeps the English a browser stored, without the fields never written", () => {
    expect(parseEnglish({ name: "Xiao Lin", bio: 3 })).toEqual({ name: "Xiao Lin" });
    expect(parseEnglish(["x"])).toBeUndefined();
  });

  it("is kept with the rest of the page in this browser", () => {
    expect(
      parseProfilePatch({
        english: { bio: "Hi" },
        workRights: { visa: "open_work" },
        resumeContact: { wechat: true },
      }),
    ).toEqual({
      english: { bio: "Hi" },
      workRights: { visa: "open_work" },
      resumeContact: { phone: false, wechat: true, email: false },
    });
    expect(parseProfilePatch({ workRights: { visa: "x" } })).toEqual({});
  });
});
