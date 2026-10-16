// The chat's answers: one function per topic reads the employer's reply into the draft and says
// what it took (the ack), or asks again (retry). The state is a copy; nothing here is shared.
import { COUNTRIES, regionById } from "@/config/countries";
import { INDUSTRY_LABELS, VISA_LABELS } from "@/i18n/labels";
import type { EmploymentType, Industry } from "@/lib/types";
import { formatEmploymentTypes } from "@/lib/employment-types";
import { parsePost, readContact, readEmploymentType, readPerks, readRegion, readTitle, readVisas } from "./parse";
import { clone, type ChatState, type Topic } from "./chat-state";
import {
  numbers,
  PAY_CLAUSE,
  payText,
  perksText,
  range,
  removeClauses,
  replaceWords,
  summary,
  titleFields,
} from "./chat-text";

export type Answered = { ok: true; state: ChatState; ack: string } | { ok: false; retry: string };

const YES = /^(对|是|是的|没错|对的|嗯|好|好的|ok|yes)[。!！]?$/i;
const DONE = /(就这些|没了|没有了|好了|可以了|够了|就这样)/;
const SKIP = /(不固定|跳过|看情况|不一定|灵活|不确定)/;
const ALL = /(都可以|都行|都接受|全部)/;
const REMOVE = /(去掉|不要|删掉|删除|取消)/;
const PREVIEW = /(预览|发布|没问题|可以了|就这样|好了)/;
const MAKE_PRIVATE = /不公开/;
const MAKE_PUBLIC = /公开/;

const ANSWERS: Record<Topic, (s: ChatState, text: string) => Answered | Promise<Answered>> = {
  description: answerDescription,
  rewrite: answerRewrite,
  fix: answerFix,
  title: answerTitle,
  titleEn: answerTitleEn,
  industry: answerIndustry,
  pay: setPay,
  hours: answerHours,
  region: answerRegion,
  employmentType: answerEmploymentType,
  visa: answerVisa,
  perks: answerPerks,
  contact: answerContact,
  review: answerReview,
};

/** Reads the reply to `topic` into a copy of the state. */
export async function answer(state: ChatState, topic: Topic, text: string): Promise<Answered> {
  return ANSWERS[topic](clone(state), text);
}

async function answerDescription(s: ChatState, text: string): Promise<Answered> {
  const parsed = await parsePost(text, s.country);
  s.draft = { ...parsed.draft, country: s.country };
  if (s.draft.visaAccepted?.length) s.asked.push("visa");
  if (s.draft.employmentType && !readEmploymentType(text)) s.unsure.push("employmentType");
  const found = summary(s.draft);
  return { ok: true, state: s, ack: found ? `收到！我整理出了：${found}。` : "收到。" };
}

function answerRewrite(s: ChatState, text: string): Answered {
  const d = s.draft;
  const field = s.fixing?.field ?? "descriptionZh";
  d[field] = text;
  if (field === "titleZh") Object.assign(d, titleFields(text));
  s.fixing = undefined;
  return { ok: true, state: s, ack: "好，已经换成新的内容。" };
}

function answerFix(s: ChatState, text: string): Answered {
  const d = s.draft;
  const fixing = s.fixing;
  if (!fixing?.rule) return { ok: false, retry: "这一项已经改好了。" };
  if (fixing.rule === "min_wage") return setPay(s, text);
  if (fixing.rule === "aewv_unaccredited") {
    if (!/去掉|删/.test(text)) return { ok: false, retry: "请点「去掉「持 AEWV 工签者」」。" };
    d.visaAccepted = (d.visaAccepted ?? []).filter((v) => v !== "aewv");
    if (d.visaAccepted.length === 0) s.asked = s.asked.filter((t) => t !== "visa");
    s.fixing = undefined;
    return { ok: true, state: s, ack: `好，去掉了「${VISA_LABELS.aewv.zh}」。` };
  }
  const field = fixing.field;
  if (/我来改写|我改|改写/.test(text)) {
    s.asking = "rewrite";
    return { ok: true, state: s, ack: "" };
  }
  if (/需会普通话/.test(text) && fixing.rule === "ethnic_preference") {
    d[field] = replaceWords(d[field] ?? "", fixing.matches ?? [], "需会普通话");
    d.languages = [...new Set([...(d.languages ?? []), "mandarin" as const])];
    s.fixing = undefined;
    return { ok: true, state: s, ack: "好，改成了「需会普通话」，也在语言要求里加上了普通话。" };
  }
  if (/删/.test(text)) {
    d[field] = removeClauses(d[field] ?? "", fixing.matches ?? []);
    if (!d[field]) delete d[field];
    s.fixing = undefined;
    return { ok: true, state: s, ack: "好，那句已经删掉了。" };
  }
  return { ok: false, retry: "请选一个：删掉这句，或者你来改写。" };
}

function answerTitle(s: ChatState, text: string): Answered {
  const d = s.draft;
  const t = readTitle(text);
  if (!t.titleZh) return { ok: false, retry: "没看懂职位名称，请直接写，例如「厨房帮工」。" };
  Object.assign(d, titleFields(text));
  return { ok: true, state: s, ack: `好，职位是「${d.titleZh}」。` };
}

function answerTitleEn(s: ChatState, text: string): Answered {
  const d = s.draft;
  if (!/^[A-Za-z][A-Za-z\s/&'-]{1,60}$/.test(text)) return { ok: false, retry: "请用英文写，例如 Kitchen hand。" };
  d.titleEn = text[0].toUpperCase() + text.slice(1);
  return { ok: true, state: s, ack: `好，英文名是 ${d.titleEn}。` };
}

function answerIndustry(s: ChatState, text: string): Answered {
  const d = s.draft;
  const hit = (Object.entries(INDUSTRY_LABELS) as [Industry, { zh: string; en: string }][]).find(
    ([, l]) => text.includes(l.zh) || text.toLowerCase().includes(l.en.toLowerCase()),
  );
  if (!hit) return { ok: false, retry: "请选一个行业。" };
  d.industry = hit[0];
  return { ok: true, state: s, ack: `好，行业是${hit[1].zh}。` };
}

function answerHours(s: ChatState, text: string): Answered {
  const d = s.draft;
  if (SKIP.test(text)) {
    delete d.hoursPerWeek;
    s.asked.push("hours");
    return { ok: true, state: s, ack: "好，工时就先不写。" };
  }
  const nums = numbers(text).filter((n) => Number.isInteger(n) && n >= 1 && n <= 80);
  if (!nums.length) return { ok: false, retry: "每周大概多少小时？写数字就行，例如 20 或 20-30；不固定也可以。" };
  d.hoursPerWeek = nums[1] != null && nums[1] > nums[0] ? { min: nums[0], max: nums[1] } : { min: nums[0] };
  s.asked.push("hours");
  return { ok: true, state: s, ack: `好，每周 ${range(d.hoursPerWeek)} 小时。` };
}

function answerRegion(s: ChatState, text: string): Answered {
  const d = s.draft;
  const id = readRegion(text, s.country);
  if (!id) return { ok: false, retry: "没找到这个区，可以点下面的地区。" };
  d.regionId = id;
  return { ok: true, state: s, ack: `好，地区是${regionById(s.country, id)?.nameZh}。` };
}

function answerEmploymentType(s: ChatState, text: string): Answered {
  const d = s.draft;
  const confirming = s.unsure.includes("employmentType") && d.employmentType;
  const named = readEmploymentType(text);
  const acceptsAll = /^(?:都可以|都行|都接受|全部(?:可以|都可以|接受)?)[\s。！!]*$/.test(text.trim());
  const type =
    confirming && YES.test(text)
      ? d.employmentType
      : (named ?? (acceptsAll ? (["full_time", "part_time", "casual"] as EmploymentType[]) : undefined));
  if (!type) return { ok: false, retry: "接受全职、兼职还是临时工？可以写多种，也可以选「都可以」。" };
  d.employmentType = type;
  s.unsure = s.unsure.filter((t) => t !== "employmentType");
  return { ok: true, state: s, ack: `好，接受${formatEmploymentTypes(type)}。` };
}

function answerVisa(s: ChatState, text: string): Answered {
  const d = s.draft;
  const visas = COUNTRIES[s.country].visaTypes;
  const chosen = d.visaAccepted ?? [];
  if (ALL.test(text)) {
    d.visaAccepted = [...visas];
    s.asked.push("visa");
    return { ok: true, state: s, ack: "好，这些签证都可以。" };
  }
  if (DONE.test(text)) {
    if (!chosen.length) return { ok: false, retry: "至少选一种可以接受的签证。" };
    s.asked.push("visa");
    return { ok: true, state: s, ack: "好的。" };
  }
  if (REMOVE.test(text)) {
    const drop = readVisas(text.replace(REMOVE, ""));
    if (!drop.length) return { ok: false, retry: "要去掉哪一种签证？" };
    d.visaAccepted = chosen.filter((v) => !drop.includes(v));
    return { ok: true, state: s, ack: `已去掉：${drop.map((v) => VISA_LABELS[v].zh).join("、")}。` };
  }
  const add = readVisas(text).filter((v) => visas.includes(v) && !chosen.includes(v));
  if (!add.length)
    return {
      ok: false,
      retry: chosen.length ? "还有别的吗？没有就点「就这些」。" : "可以接受哪些签证？点下面的选项，可以选几种。",
    };
  d.visaAccepted = visas.filter((v) => chosen.includes(v) || add.includes(v));
  return { ok: true, state: s, ack: `已加上：${add.map((v) => VISA_LABELS[v].zh).join("、")}。` };
}

function answerPerks(s: ChatState, text: string): Answered {
  const d = s.draft;
  const none =
    /(都不包|不包|没有|都没有)/.test(text) && !/包(吃住|餐|吃|住)/.test(text.replace(/不包(吃住|餐|吃|住)?/g, ""));
  const read = readPerks(text);
  if (!none && read.mealsIncluded == null && read.accommodationIncluded == null)
    return { ok: false, retry: "包餐还是包住？都不包也可以。" };
  d.mealsIncluded = none ? false : (read.mealsIncluded ?? false);
  d.accommodationIncluded = none ? false : (read.accommodationIncluded ?? false);
  s.asked.push("perks");
  return { ok: true, state: s, ack: `好，${perksText(d)}。` };
}

function answerContact(s: ChatState, text: string): Answered {
  const d = s.draft;
  const found = readContact(text);
  if (!found.phone && !found.wechat && !found.email && /^[A-Za-z][-_A-Za-z0-9]{5,19}$/.test(text)) found.wechat = text;
  if (!found.phone && !found.wechat && !found.email) {
    return { ok: false, retry: "没认出电话、微信号或邮箱，再发一次？例如 021 xxx xxxx，或者微信号 abc_123。" };
  }
  d.contact = found;
  return {
    ok: true,
    state: s,
    ack: d.contactPublic ? "好，联系方式记下了，只有登录的求职者才能看到。" : "好，联系方式记下了。",
  };
}

function answerReview(s: ChatState, text: string): Answered {
  const d = s.draft;
  if (MAKE_PRIVATE.test(text) || MAKE_PUBLIC.test(text)) {
    d.contactPublic = !MAKE_PRIVATE.test(text);
    return { ok: true, state: s, ack: d.contactPublic ? "好，联系方式改为公开。" : "好，联系方式不公开。" };
  }
  if (!PREVIEW.test(text)) return { ok: false, retry: "还有要改的吗？可以说「改一下时薪」，或者点「预览并发布」。" };
  s.ready = true;
  return { ok: true, state: s, ack: "好的，下面是求职者会看到的样子，确认后就能发布。" };
}

function setPay(s: ChatState, text: string): Answered {
  if (/(周薪|年薪|月薪)/.test(text))
    return { ok: false, retry: "这里只填时薪。按每周工时换算一下，写时薪就行，例如 25。" };
  const nums = numbers(text).filter((n) => n >= 10 && n <= 200);
  if (!nums.length) return { ok: false, retry: "没看懂时薪，请直接写数字，例如 25 或 25-28。" };
  const [min, max] = nums[1] != null && nums[1] < nums[0] ? [nums[1], nums[0]] : [nums[0], nums[1]];
  s.draft.pay = max != null && max !== min ? { min, max } : { min };
  // The old figure may still be in the description; pay shows on its own, so drop that sentence.
  if (s.draft.descriptionZh)
    s.draft.descriptionZh = removeClauses(s.draft.descriptionZh, [], PAY_CLAUSE) || s.draft.descriptionZh;
  if (s.fixing?.rule === "min_wage") s.fixing = undefined;
  return { ok: true, state: s, ack: `好，时薪 ${payText(s)}。` };
}
