import { describe, expect, it } from "vitest";
import { nextTurn, resumeChat, startChat, type ChatState } from "@/lib/ai-post/chat";
import { missingFields } from "@/lib/ai-post";
import { checkJob } from "@/lib/compliance";

async function say(state: ChatState, ...messages: string[]): Promise<ChatState> {
  for (const m of messages) state = await nextTurn(state, m);
  return state;
}
const last = (s: ChatState) => s.messages[s.messages.length - 1];
const replies = (s: ChatState) => (last(s).quickReplies ?? []).map((q) => q.label);

describe("startChat", () => {
  it("greets and asks for the job in the employer's own words, with a sample to try", () => {
    const s = startChat("NZ");
    expect(s.messages).toHaveLength(1);
    expect(last(s)).toMatchObject({ from: "assistant" });
    expect(last(s).text).toContain("用你自己的话");
    expect(replies(s)).toEqual(["用示例试试"]);
    expect(s.asking).toBe("description");
    expect(s.ready).toBe(false);
  });
});

describe("a full conversation, one question at a time", () => {
  it("goes from a short message to a complete job", async () => {
    let s = await say(startChat("NZ"), "招洗碗工");
    expect(s.messages.at(-2)).toMatchObject({ from: "employer", text: "招洗碗工" });
    expect(s.draft).toMatchObject({ titleZh: "洗碗工", titleEn: "Dishwasher", industry: "hospitality" });
    expect(s.asking).toBe("pay");
    expect(last(s).text).toContain("时薪");

    s = await say(s, "25");
    expect(s.draft.pay).toEqual({ min: 25 });
    expect(s.asking).toBe("hours");
    expect(replies(s)).toContain("不固定");

    s = await say(s, "20-30");
    expect(s.draft.hoursPerWeek).toEqual({ min: 20, max: 30 });
    expect(s.asking).toBe("region");
    expect(replies(s)).toContain("Northcote");

    s = await say(s, "Northcote");
    expect(s.draft.regionId).toBe("akl-northcote");
    expect(s.asking).toBe("employmentType");
    expect(replies(s)).toEqual(["全职", "兼职", "临时工", "全职或兼职", "都可以"]);

    s = await say(s, "兼职");
    expect(s.draft.employmentType).toEqual(["part_time"]);
    expect(s.asking).toBe("visa");
    expect(replies(s)).toContain("学签");
    expect(replies(s)).not.toContain("就这些"); // nothing chosen yet

    s = await say(s, "学签");
    expect(s.draft.visaAccepted).toEqual(["student"]);
    expect(s.asking).toBe("visa");
    expect(replies(s)).toContain("就这些");
    expect(replies(s)).not.toContain("学签");

    s = await say(s, "打工度假", "就这些");
    expect(s.draft.visaAccepted).toEqual(["student", "working_holiday"]);
    expect(s.asking).toBe("perks");
    expect(replies(s)).toEqual(["包餐", "包住", "包吃住", "都不包"]);

    s = await say(s, "包餐");
    expect(s.draft).toMatchObject({ mealsIncluded: true, accommodationIncluded: false });
    expect(s.asking).toBe("review");
    expect(last(s).text).toContain("联系方式不公开：求职者在聊天里申请交换，你同意后才给。");
    expect(replies(s)).toContain("公开联系方式");
    expect(missingFields(s.draft)).toEqual([]);

    s = await say(s, "公开联系方式");
    expect(s.draft.contactPublic).toBe(true);
    expect(s.asking).toBe("contact");

    s = await say(s, "demo_wash");
    expect(s.draft.contact).toEqual({ wechat: "demo_wash" });
    expect(s.asking).toBe("review");
    expect(last(s).text).toContain("联系方式公开：登录的求职者能在职位页看到你的微信。");
    expect(replies(s)).toContain("不公开联系方式");
    expect(last(s).text).toContain("洗碗工");
    expect(last(s).text).toContain("$25/小时");
    expect(replies(s)).toContain("预览并发布");
    expect(missingFields(s.draft)).toEqual([]);
    expect(checkJob(s.draft, "NZ")).toEqual([]);
    expect(s.draft.descriptionEn).toContain("Part-time dishwasher in Northcote");

    s = await say(s, "预览并发布");
    expect(s.ready).toBe(true);
  });

  it("skips the questions the first message already answered", async () => {
    const s = await say(
      startChat("NZ"),
      "Mt Eden 川菜馆招前厅服务员，全职，时薪 $25-27，每周 40 小时，包工作餐，学签可做。微信 demo_chuanwei",
    );
    expect(last(s).text).toContain("收到");
    expect(s.asking).toBe("review");
  });

  it("asks to confirm an employment type it only guessed from the hours", async () => {
    let s = await say(
      startChat("NZ"),
      "Mt Eden 川菜馆招前厅服务员，时薪 $25-27，每周 15-25 小时，包工作餐，学签可做。微信 demo_chuanwei",
    );
    expect(s.asking).toBe("employmentType");
    expect(last(s).text).toContain("先当作兼职");
    expect(replies(s)).toEqual(["对", "全职", "临时工", "全职或兼职", "都可以"]);
    s = await say(s, "对");
    expect(s.draft.employmentType).toEqual(["part_time"]);
    expect(s.asking).toBe("review");
  });
});

describe("contact details: private unless the employer makes them public", () => {
  const POST = "Mt Eden 川菜馆招前厅服务员，全职，时薪 $25-27，每周 40 小时，包工作餐，学签可做。微信 demo_chuanwei";

  it("does not ask for contact details, and says the ones in the post stay hidden", async () => {
    const s = await say(startChat("NZ"), POST);
    expect(s.asking).toBe("review");
    expect(s.draft.contactPublic).toBeUndefined();
    expect(last(s).text).toContain("联系方式不公开：你写的微信不会显示，求职者在聊天里申请交换，你同意后才给。");
    expect(last(s).text).toContain("企业主页");
  });

  it("makes the details in the post public without asking for them again", async () => {
    const s = await say(startChat("NZ"), POST, "公开联系方式");
    expect(s.draft).toMatchObject({ contactPublic: true, contact: { wechat: "demo_chuanwei" } });
    expect(s.asking).toBe("review");
    expect(last(s).text).toContain("联系方式公开");
  });

  it("can switch back to private", async () => {
    const s = await say(startChat("NZ"), POST, "公开联系方式", "不公开联系方式");
    expect(s.draft.contactPublic).toBe(false);
    expect(s.asking).toBe("review");
    expect(last(s).text).toContain("联系方式不公开");
  });

  it("no longer asks how to be contacted in its greeting", () => {
    expect(last(startChat("NZ")).text).not.toContain("怎么联系你");
  });
});

describe("AEWV in the conversation", () => {
  const POST = "Mt Eden 川菜馆招前厅服务员，全职，时薪 $25-27，每周 40 小时，包工作餐，雇主担保工签可。";

  it("offers AEWV holders only to an accredited employer", async () => {
    const plain = await say({ ...startChat("NZ"), employer: { verification: "business_verified" } }, "招洗碗工");
    const asked = await say(plain, "25", "不固定", "Northcote", "兼职");
    expect(asked.asking).toBe("visa");
    expect(replies(asked)).not.toContain("持 AEWV 工签者");

    const accredited = await say(
      { ...startChat("NZ"), employer: { verification: "accredited_employer" } },
      "招洗碗工",
      "25",
      "不固定",
      "Northcote",
      "兼职",
    );
    expect(replies(accredited)).toContain("持 AEWV 工签者");
  });

  it("asks a business that is not accredited to take AEWV off the list", async () => {
    let s = await say({ ...startChat("NZ"), employer: { verification: "business_verified" } }, POST);
    expect(s.asking).toBe("fix");
    expect(last(s).text).toContain("持 AEWV 工签者");
    expect(replies(s)).toEqual(["去掉「持 AEWV 工签者」"]);
    s = await say(s, "去掉「持 AEWV 工签者」");
    expect(s.draft.visaAccepted).not.toContain("aewv");
    expect(s.asking).not.toBe("fix");
  });
});

describe("multiple employment types", () => {
  it("does not turn an excluded type into accepting everything", async () => {
    let s = await say(startChat("NZ"), "招洗碗工", "25", "不固定", "Northcote");
    s = await say(s, "不要全职，都可以");
    expect(s.draft.employmentType).toBeUndefined();
    expect(s.asking).toBe("employmentType");
  });

  it.each([
    ["都可以", ["full_time", "part_time", "casual"]],
    ["全职或兼职都可以", ["full_time", "part_time"]],
    ["不要全职，兼职或临时工", ["part_time", "casual"]],
  ])("accepts %s without asking the same question again", async (answer, expected) => {
    let s = await say(startChat("NZ"), "招洗碗工", "25", "不固定", "Northcote");
    expect(s.asking).toBe("employmentType");
    s = await say(s, answer);
    expect(s.draft.employmentType).toEqual(expected);
    expect(s.asking).toBe("visa");
    expect(missingFields(s.draft)).not.toContain("employmentType");
  });

  it("preserves all types when confirming a guess or changing a reviewed job", async () => {
    let s = await say(startChat("NZ"), "Mt Eden 招服务员，时薪25，每周20小时，包餐，学签，微信 demo_multi");
    expect(s.asking).toBe("employmentType");
    s = await say(s, "都可以");
    expect(s.asking).toBe("review");
    s = await say(s, "改成兼职和临时工");
    expect(s.draft.employmentType).toEqual(["part_time", "casual"]);
    expect(s.asking).toBe("review");
    expect(s.draft.descriptionEn).toContain("Part-time / Casual");
  });
});

describe("compliance in the conversation", () => {
  it("asks for each fix in turn and applies the employer's choice", async () => {
    let s = await say(
      startChat("NZ"),
      "奶茶店招兼职店员，市中心，时薪 18，入职交押金200，限华人。学签OK。微信 cbdtea_demo",
    );
    expect(s.asking).toBe("fix");
    expect(last(s).text).toContain("时薪 $18 低于新西兰最低工资 $23.95");
    expect(last(s).text).toContain("改成多少");

    s = await say(s, "24");
    expect(s.draft.pay).toEqual({ min: 24 });
    expect(s.asking).toBe("fix");
    expect(last(s).text).toContain("「押金」");
    expect(replies(s)).toEqual(["删掉这句", "我来改写"]);

    s = await say(s, "删掉这句");
    expect(s.draft.descriptionZh).not.toContain("押金");
    expect(last(s).text).toContain("「限华人」");
    expect(replies(s)).toEqual(["改成「需会普通话」", "删掉这句", "我来改写"]);

    s = await say(s, "改成「需会普通话」");
    expect(s.draft.descriptionZh).toContain("需会普通话");
    expect(s.draft.descriptionZh).not.toContain("限华人");
    expect(s.draft.languages).toContain("mandarin");
    expect(checkJob(s.draft, "NZ").filter((f) => f.level !== "review")).toEqual([]);
    expect(s.asking).toBe("hours");
  });

  it("lets the employer rewrite a sentence instead", async () => {
    let s = await say(
      startChat("NZ"),
      "招厨师，时薪 28，全职，每周 40 小时，Albany，表现好包签。公民永居。不包吃住。微信 demo_chef8",
    );
    expect(last(s).text).toContain("「包签」");
    s = await say(s, "我来改写");
    expect(s.asking).toBe("rewrite");
    s = await say(s, "招厨师，全职，工作稳定。");
    expect(s.draft.descriptionZh).toBe("招厨师，全职，工作稳定。");
    expect(s.asking).toBe("review");
  });

  it("mentions a review once and does not hold the job", async () => {
    const s = await say(
      startChat("NZ"),
      "Newmarket KTV 招前台服务员，兼职，时薪 $26，每周 20 小时，学签可做，不包吃住。微信 demo_ktv_nz",
    );
    const notes = s.messages.filter((m) => m.text.includes("人工审核"));
    expect(notes).toHaveLength(1);
    expect(s.asking).toBe("review");
  });
});

describe("changing an answer, and answers it cannot read", () => {
  it("goes back to pay on 改一下时薪, then carries on where it was", async () => {
    let s = await say(startChat("NZ"), "招洗碗工", "25", "不固定");
    expect(s.asking).toBe("region");
    s = await say(s, "改一下时薪");
    expect(s.asking).toBe("pay");
    expect(last(s).text).toContain("时薪改成多少");
    s = await say(s, "26-28");
    expect(s.draft.pay).toEqual({ min: 26, max: 28 });
    expect(s.asking).toBe("region");
  });

  it("comes back to a question it was asking before the change", async () => {
    let s = await say(startChat("NZ"), "招洗碗工", "25");
    expect(s.asking).toBe("hours");
    s = await say(s, "改一下时薪", "26");
    expect(s.asking).toBe("hours");
  });

  it("applies 时薪改成 27 at once", async () => {
    let s = await say(startChat("NZ"), "招洗碗工", "25", "不固定");
    s = await say(s, "时薪改成 27");
    expect(s.draft.pay).toEqual({ min: 27 });
    expect(s.asking).toBe("region");
  });

  it("asks again, with an example, when it cannot read the answer", async () => {
    let s = await say(startChat("NZ"), "招洗碗工");
    s = await say(s, "看情况");
    expect(s.asking).toBe("pay");
    expect(last(s).text).toContain("例如 25");
    s = await say(s, "年薪5万");
    expect(s.asking).toBe("pay");
    expect(last(s).text).toContain("时薪");
  });

  it("ignores a blank message", async () => {
    const s = startChat("NZ");
    expect(await nextTurn(s, "   ")).toEqual(s);
  });

  it("answers the same way every time", async () => {
    const script = ["招洗碗工", "25", "不固定", "Northcote", "兼职", "学签", "就这些", "都不包", "09 055 0199"];
    expect(await say(startChat("NZ"), ...script)).toEqual(await say(startChat("NZ"), ...script));
  });
});

describe("resumeChat", () => {
  it("comes back from the preview ready for changes", async () => {
    let s = await say(
      startChat("NZ"),
      "Mt Eden 川菜馆招前厅服务员，全职，时薪 $25-27，每周 40 小时，包工作餐，学签可做。微信 demo_chuanwei",
      "预览并发布",
    );
    expect(s.ready).toBe(true);
    s = resumeChat(s);
    expect(s.ready).toBe(false);
    expect(s.asking).toBe("review");
    s = await say(s, "时薪改成 28");
    expect(s.draft.pay).toEqual({ min: 28 });
    expect(s.asking).toBe("review");
  });
});
