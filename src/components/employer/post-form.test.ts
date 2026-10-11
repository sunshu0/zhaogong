import { describe, expect, it } from "vitest";
import { completeJob, draftFromForm, emptyForm, formFromDraft, sanitizeDraft } from "@/components/employer/post-form";
import type { JobDraft } from "@/lib/compliance";

const full: JobDraft = {
  country: "NZ",
  titleZh: "前厅服务员",
  titleEn: "Front-of-house staff",
  industry: "hospitality",
  employmentType: "part_time",
  regionId: "akl-mt-eden",
  pay: { min: 25, max: 27 },
  hoursPerWeek: { min: 15, max: 25 },
  shiftsZh: "周末晚班",
  mealsIncluded: true,
  visaAccepted: ["student"],
  languages: ["mandarin"],
  descriptionZh: "点餐、上菜。",
  descriptionEn: "Taking orders.",
  contact: { wechat: "demo_x" },
  urgent: true,
};

describe("form ⇄ draft", () => {
  it("round-trips a full draft", () => {
    expect(draftFromForm(formFromDraft(full), "NZ")).toEqual({ ...full, accommodationIncluded: false });
  });

  it("drops empty text, empty contact and a pay without its lower end", () => {
    const form = { ...emptyForm(), titleZh: "  ", payMax: 30, phone: " " };
    const draft = draftFromForm(form, "NZ");
    expect(draft.titleZh).toBeUndefined();
    expect(draft.pay).toBeUndefined();
    expect(draft.contact).toEqual({});
  });

  it("keeps the upper end of pay and hours only when it is above the lower end", () => {
    const draft = draftFromForm({ ...emptyForm(), payMin: 25, payMax: 25, hoursMin: 20, hoursMax: 10 }, "NZ");
    expect(draft.pay).toEqual({ min: 25 });
    expect(draft.hoursPerWeek).toEqual({ min: 20 });
  });
});

describe("completeJob", () => {
  const now = Date.UTC(2026, 9, 12);

  it("fills defaults and runs 30 days from now", () => {
    const job = completeJob({ ...full, mealsIncluded: undefined, urgent: undefined }, "e1", now, "active");
    expect(job).toMatchObject({ employerId: "e1", status: "active", mealsIncluded: false, accommodationIncluded: false, urgent: false });
    expect(job?.postedAt).toBe("2026-10-12T00:00:00.000Z");
    expect(job?.expiresAt).toBe("2026-11-11T00:00:00.000Z");
  });

  it("returns nothing while a required field is missing", () => {
    expect(completeJob({ ...full, regionId: undefined }, "e1", now, "active")).toBeUndefined();
  });
});

describe("sanitizeDraft", () => {
  it("keeps a well-formed draft as it is", () => {
    expect(sanitizeDraft(full, "NZ")).toEqual(full);
  });

  it("drops unknown keys, wrong types and values outside the enums", () => {
    const dirty = {
      ...full,
      status: "active",
      employerId: "e9",
      industry: "casino",
      regionId: "sydney",
      pay: { min: "25" },
      visaAccepted: ["student", "golden_visa", 3],
      contact: { phone: 12345, wechat: "ok_id", fax: "x" },
      titleZh: "x".repeat(500),
    };
    const clean = sanitizeDraft(dirty, "NZ");
    expect(clean).not.toHaveProperty("status");
    expect(clean).not.toHaveProperty("employerId");
    expect(clean.industry).toBeUndefined();
    expect(clean.regionId).toBeUndefined();
    expect(clean.pay).toBeUndefined();
    expect(clean.visaAccepted).toEqual(["student"]);
    expect(clean.contact).toEqual({ wechat: "ok_id" });
    expect(clean.titleZh).toHaveLength(80);
    expect(clean.country).toBe("NZ");
  });

  it("returns an empty draft for something that is not an object", () => {
    expect(sanitizeDraft("hello", "NZ")).toEqual({ country: "NZ" });
  });
});
