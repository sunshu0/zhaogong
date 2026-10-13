import { describe, expect, it } from "vitest";
import { englishSummary, missingFields, parsePost } from "@/lib/ai-post";
import { checkJob } from "@/lib/compliance";

// Messages written the way employers post in WeChat groups. All names and numbers are invented.
const MSG = {
  frontOfHouse: `【急招】Mt Eden 川菜馆招前厅服务员 2 名
时薪 $25-27，每周 15-25 小时，周五至周日晚班
包工作餐，学签可做，需会普通话和基本英语
有意者请加微信 demo_chuanwei 或电话 021 555 0101`,
  dimSum: "北岸 Northcote 早茶酒家诚聘点心师傅，全职，需三年以上经验。时薪30-35刀，包两餐。接受开放工签及AEWV（本店为认证雇主）。联系电话：021-555-0102",
  grocery: "Botany亚洲超市招理货员，早班7点到1点，每周20-30小时，$24/h，要能搬重物。学生签证、打工度假都可以，不包住。电话 0215550103",
  carpenter: "招聘装修木工两名，Albany 附近工地，需有 Site Safe 证，自备工具和车。时薪 32-40 看经验，全职，每周 40-50 小时。公民永居或开放工签。微信：anju_reno88",
  cleaner: "东区 Howick 家政公司招清洁工，时间灵活，$25 一小时起，需要有驾照和车。不需要英语。有意加V：demo_jiejing",
  bubbleTea: "奶茶店招兼职店员，市中心 Queen St，时薪 20，包培训。学签OK，要会英语。微信 cbdtea_demo",
  english: "Hiring kitchen hand at Sylvia Park, full time 40 hrs/week, $26 per hour. Mandarin or English. Open work visa or resident. Email: hr@example.com",
  driver: "快达物流急聘送货司机，需 Class 2 驾照，全职，周一到周五，$27-30/小时，Mt Wellington 仓库出发。认证雇主，可接受 AEWV。联系 021 555 0107 / hr@example.com",
  livein: "Manukau 餐馆招厨师一名，包吃住，周薪 1000，粤语优先。电话 09 123 4567",
  minimal: "招洗碗工，有意私聊",
};

describe("parsePost", () => {
  it("reads a typical restaurant post", async () => {
    const { draft, missing } = await parsePost(MSG.frontOfHouse, "NZ");
    expect(draft).toMatchObject({
      country: "NZ",
      titleZh: "前厅服务员",
      titleEn: "Front-of-house staff",
      industry: "hospitality",
      employmentType: "part_time", // inferred from 15–25 hours a week
      regionId: "akl-mt-eden",
      pay: { min: 25, max: 27 },
      hoursPerWeek: { min: 15, max: 25 },
      shiftsZh: "周五至周日晚班",
      mealsIncluded: true,
      urgent: true,
      contact: { wechat: "demo_chuanwei", phone: "021 555 0101" },
    });
    expect(draft.visaAccepted).toEqual(["student"]);
    expect(draft.languages).toEqual(["mandarin", "english"]);
    expect(draft.accommodationIncluded).toBeUndefined();
    expect(missing).toEqual([]);
  });

  it("keeps contact details out of the description", async () => {
    const { draft } = await parsePost(MSG.frontOfHouse, "NZ");
    expect(draft.descriptionZh).toContain("学签可做");
    expect(draft.descriptionZh).toContain("时薪 $25-27，每周"); // full-width punctuation kept as written
    expect(draft.descriptionZh).not.toContain("021");
    expect(draft.descriptionZh).not.toContain("demo_chuanwei");
    expect(draft.descriptionZh).not.toContain("有意者");
  });

  it("reads 诚聘, 刀 and an accredited employer's visa list", async () => {
    const { draft, missing } = await parsePost(MSG.dimSum, "NZ");
    expect(draft).toMatchObject({
      titleZh: "点心师傅",
      titleEn: "Dim sum chef",
      industry: "hospitality",
      employmentType: "full_time",
      regionId: "akl-northcote",
      pay: { min: 30, max: 35 },
      mealsIncluded: true,
      contact: { phone: "021-555-0102" },
    });
    expect(draft.visaAccepted).toEqual(["open_work", "aewv"]);
    expect(missing).toEqual([]);
    expect(draft.descriptionZh).toContain("本店为认证雇主");
    expect(draft.descriptionZh).not.toContain("联系电话");
  });

  it("does not mistake clock times for pay, and reads 不包住", async () => {
    const { draft } = await parsePost(MSG.grocery, "NZ");
    expect(draft).toMatchObject({
      titleZh: "理货员",
      industry: "retail",
      regionId: "akl-botany",
      pay: { min: 24 },
      hoursPerWeek: { min: 20, max: 30 },
      employmentType: "part_time",
      accommodationIncluded: false,
      contact: { phone: "0215550103" },
    });
    expect(draft.pay?.max).toBeUndefined();
    expect(draft.visaAccepted).toEqual(["student", "working_holiday"]);
  });

  it("strips the head count from the title", async () => {
    const { draft } = await parsePost(MSG.carpenter, "NZ");
    expect(draft).toMatchObject({
      titleZh: "装修木工",
      titleEn: "Carpenter",
      industry: "construction",
      regionId: "akl-albany",
      pay: { min: 32, max: 40 },
      hoursPerWeek: { min: 40, max: 50 },
      employmentType: "full_time",
      contact: { wechat: "anju_reno88" },
    });
    expect(draft.visaAccepted).toEqual(["citizen_resident", "open_work"]);
  });

  it("reads 一小时 pay, 加V and a language that is not needed", async () => {
    const { draft, missing } = await parsePost(MSG.cleaner, "NZ");
    expect(draft).toMatchObject({
      titleZh: "清洁工",
      titleEn: "Cleaner",
      industry: "cleaning",
      regionId: "akl-howick",
      pay: { min: 25 },
      contact: { wechat: "demo_jiejing" },
    });
    expect(draft.languages).toEqual([]);
    expect(missing).toEqual(["employmentType", "visaAccepted"]);
  });

  it("passes low pay through untouched: the compliance check judges it, not the parser", async () => {
    const { draft } = await parsePost(MSG.bubbleTea, "NZ");
    expect(draft).toMatchObject({
      titleZh: "店员",
      industry: "hospitality",
      employmentType: "part_time",
      regionId: "akl-cbd",
      pay: { min: 20 },
      contact: { wechat: "cbdtea_demo" },
    });
    expect(draft.visaAccepted).toEqual(["student"]);
    expect(draft.languages).toEqual(["english"]);
    expect(checkJob(draft, "NZ").map((f) => f.rule)).toEqual(["min_wage"]);
  });

  it("reads an English post and fills in the Chinese title", async () => {
    const { draft, missing } = await parsePost(MSG.english, "NZ");
    expect(draft).toMatchObject({
      titleZh: "厨房帮工",
      titleEn: "Kitchen hand",
      industry: "hospitality",
      employmentType: "full_time",
      regionId: "akl-mt-wellington",
      pay: { min: 26 },
      hoursPerWeek: { min: 40 },
      contact: { email: "hr@example.com" },
    });
    expect(draft.languages).toEqual(["mandarin", "english"]);
    expect(draft.visaAccepted).toEqual(["citizen_resident", "open_work"]);
    expect(missing).toEqual([]);
  });

  it("lets the title decide the industry over other words in the text", async () => {
    const { draft } = await parsePost(MSG.driver, "NZ");
    expect(draft).toMatchObject({
      titleZh: "送货司机",
      titleEn: "Delivery driver",
      industry: "driver",
      urgent: true,
      employmentType: "full_time",
      shiftsZh: "周一到周五",
      pay: { min: 27, max: 30 },
      regionId: "akl-mt-wellington",
      contact: { phone: "021 555 0107", email: "hr@example.com" },
    });
    expect(draft.visaAccepted).toEqual(["aewv"]);
  });

  it("reads 包吃住 and asks for an hourly rate when the post gives a weekly one", async () => {
    const { draft, missing, notes_zh } = await parsePost(MSG.livein, "NZ");
    expect(draft).toMatchObject({
      titleZh: "厨师",
      titleEn: "Chef",
      regionId: "akl-manukau",
      mealsIncluded: true,
      accommodationIncluded: true,
      contact: { phone: "09 123 4567" },
    });
    expect(draft.pay).toBeUndefined();
    expect(draft.languages).toEqual(["cantonese"]);
    expect(missing).toContain("pay");
    expect(notes_zh.join()).toContain("时薪");
  });

  it("lists what a minimal post leaves out", async () => {
    const { draft, missing } = await parsePost(MSG.minimal, "NZ");
    expect(draft).toMatchObject({ titleZh: "洗碗工", titleEn: "Dishwasher", industry: "hospitality" });
    expect(missing).toEqual(["employmentType", "pay", "regionId", "visaAccepted", "contact"]);
  });

  it("reads full-width digits and letters but keeps the text as written", async () => {
    const { draft } = await parsePost("招服务员，时薪２５刀，ＫＴＶ旁边，电话 ０２１ ５５５ ０１０９", "NZ");
    expect(draft.pay).toEqual({ min: 25 });
    expect(draft.contact).toEqual({ phone: "021 555 0109" });
    expect(draft.descriptionZh).toBe("招服务员，时薪２５刀，ＫＴＶ旁边");
  });

  it("returns an empty draft for empty text", async () => {
    const { draft, missing } = await parsePost("   ", "NZ");
    expect(draft.titleZh).toBeUndefined();
    expect(missing).toContain("titleZh");
    expect(missing).toContain("descriptionZh");
  });
});

describe("englishSummary", () => {
  it("keeps explicit multiple types instead of inferring only one from hours", async () => {
    const { draft } = await parsePost("Mt Eden 招服务员，全职或兼职，每周20小时，时薪25，学签可做，微信 demo_multi", "NZ");
    expect(draft.employmentType).toEqual(["full_time", "part_time"]);
    expect(draft.descriptionEn).toContain("Full-time / Part-time");
  });

  it("does not include explicitly excluded types", async () => {
    const { draft } = await parsePost("招服务员，不要全职，只招兼职或临时工", "NZ");
    expect(draft.employmentType).toEqual(["part_time", "casual"]);
  });
  it("writes an English description from the structured fields", async () => {
    const { draft } = await parsePost(MSG.frontOfHouse, "NZ");
    expect(englishSummary(draft, "NZ")).toBe(
      "Part-time front-of-house staff in Mt Eden / Dominion Rd. $25–27 an hour, 15–25 hours a week. Meals included. Languages: Mandarin, English. Visas accepted: Student visa.",
    );
    expect(draft.descriptionEn).toBe(englishSummary(draft, "NZ"));
  });
});

describe("missingFields", () => {
  it("requires at least one employment type", () => {
    expect(missingFields({ employmentType: [] })).toContain("employmentType");
  });
  it("treats empty lists and empty contact as missing", () => {
    expect(missingFields({ titleZh: "x", visaAccepted: [], contact: {} })).toContain("visaAccepted");
    expect(missingFields({ titleZh: "x", visaAccepted: [], contact: {} })).toContain("contact");
  });
});
