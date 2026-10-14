// AI chat posting, stage one: a deterministic assistant behind nextTurn(state, message), the
// interface a real model call replaces later. It asks one thing at a time — what is missing, what it
// only guessed, and what the compliance check objects to — and fills the draft as answers come in.
// Same state and message in, same state out: the landing page replays real conversations with it.
import { COUNTRIES, regionById } from "@/config/countries";
import { EMPLOYMENT_TYPE_LABELS, INDUSTRY_LABELS, PRODUCT_NAME, VISA_LABELS } from "@/i18n/labels";
import { checkJob, type Finding, type JobDraft, type RuleId } from "@/lib/compliance";
import type { CountryCode, EmploymentType, Industry } from "@/lib/types";
import { formatEmploymentTypes } from "@/lib/employment-types";
import {
  englishSummary,
  missingFields,
  parsePost,
  readContact,
  readEmploymentType,
  readPerks,
  readRegion,
  readTitle,
  readVisas,
} from "./parse";

export type Topic =
  | "description"
  | "rewrite"
  | "fix"
  | "title"
  | "titleEn"
  | "industry"
  | "pay"
  | "hours"
  | "region"
  | "employmentType"
  | "visa"
  | "perks"
  | "contact"
  | "review";

export interface QuickReply {
  label: string;
  /** Sent as the employer's message; the label when not set. */
  value?: string;
}

export interface ChatMessage {
  id: string;
  from: "assistant" | "employer";
  text: string;
  quickReplies?: QuickReply[];
}

export interface ChatState {
  country: CountryCode;
  draft: JobDraft;
  messages: ChatMessage[];
  /** What the assistant is waiting for. */
  asking: Topic;
  /** The finding being fixed (asking "fix") or the text field being rewritten (asking "rewrite"). */
  fixing?: { rule?: RuleId; field: TextField; matches?: string[] };
  /** Optional items (hours, meals, visas) the employer has answered or skipped, so they are not asked again. */
  asked: Topic[];
  /** Things filled in by a guess that the employer should confirm. */
  unsure: Topic[];
  /** Review-level findings already mentioned. */
  noted: string[];
  /** The employer chose 预览并发布. */
  ready: boolean;
}

type TextField = "titleZh" | "titleEn" | "descriptionZh" | "shiftsZh" | "address";

export const SAMPLE_POST = `【急招】Mt Eden 川菜馆招前厅服务员 2 名
时薪 $25-27，每周 15-25 小时，周五至周日晚班
包工作餐，学签可做，需会普通话和基本英语
有意者请加微信 demo_chuanwei 或电话 021 555 0101`;

export function startChat(country: CountryCode): ChatState {
  return {
    country,
    draft: { country },
    messages: [
      {
        id: "m1",
        from: "assistant",
        text: `你好！我是${PRODUCT_NAME}的发帖助手，一步步帮你把招聘写清楚。\n先用你自己的话说说这份工作：招什么人、在哪个区、时薪多少。直接粘贴微信群里的招聘消息也行。`,
        quickReplies: [{ label: "用示例试试", value: SAMPLE_POST }],
      },
    ],
    asking: "description",
    asked: [],
    unsure: [],
    noted: [],
    ready: false,
  };
}

/** One turn: the employer's message in, the assistant's reply (and the updated draft) out. */
export async function nextTurn(state: ChatState, message: string): Promise<ChatState> {
  const text = String(message ?? "")
    .trim()
    .slice(0, 2000);
  if (!text) return state;
  const s = withMessage(state, "employer", text);

  const change =
    s.asking === "description" || s.asking === "rewrite" || s.asking === "fix" ? undefined : changeIntent(text);
  if (change) {
    if (change.value) {
      const done = await answer(s, change.topic, change.value);
      if (done.ok) return proceed(done.state, done.ack);
    }
    return askAbout(reopen(s, change.topic), change.topic, CHANGE_PROMPTS[change.topic]);
  }

  const done = await answer(s, s.asking, text);
  if (!done.ok) return askAbout(s, s.asking, done.retry);
  if (done.state.ready) return withMessage(done.state, "assistant", done.ack);
  return proceed(done.state, done.ack);
}

// ---- answers ----

type Answered = { ok: true; state: ChatState; ack: string } | { ok: false; retry: string };

const YES = /^(对|是|是的|没错|对的|嗯|好|好的|ok|yes)[。!！]?$/i;
const DONE = /(就这些|没了|没有了|好了|可以了|够了|就这样)/;
const SKIP = /(不固定|跳过|看情况|不一定|灵活|不确定)/;
const ALL = /(都可以|都行|都接受|全部)/;
const REMOVE = /(去掉|不要|删掉|删除|取消)/;
const PREVIEW = /(预览|发布|没问题|可以了|就这样|好了)/;
const MAKE_PRIVATE = /不公开/;
const MAKE_PUBLIC = /公开/;

async function answer(state: ChatState, topic: Topic, text: string): Promise<Answered> {
  const s = clone(state);
  const d = s.draft;
  switch (topic) {
    case "description": {
      const parsed = await parsePost(text, s.country);
      s.draft = { ...parsed.draft, country: s.country };
      if (s.draft.visaAccepted?.length) s.asked.push("visa");
      if (s.draft.employmentType && !readEmploymentType(text)) s.unsure.push("employmentType");
      const found = summary(s.draft);
      return { ok: true, state: s, ack: found ? `收到！我整理出了：${found}。` : "收到。" };
    }
    case "rewrite": {
      const field = s.fixing?.field ?? "descriptionZh";
      d[field] = text;
      if (field === "titleZh") Object.assign(d, titleFields(text));
      s.fixing = undefined;
      return { ok: true, state: s, ack: "好，已经换成新的内容。" };
    }
    case "fix": {
      const fixing = s.fixing;
      if (!fixing?.rule) return { ok: false, retry: "这一项已经改好了。" };
      if (fixing.rule === "min_wage") return setPay(s, text);
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
    case "title": {
      const t = readTitle(text);
      if (!t.titleZh) return { ok: false, retry: "没看懂职位名称，请直接写，例如「厨房帮工」。" };
      Object.assign(d, titleFields(text));
      return { ok: true, state: s, ack: `好，职位是「${d.titleZh}」。` };
    }
    case "titleEn": {
      if (!/^[A-Za-z][A-Za-z\s/&'-]{1,60}$/.test(text)) return { ok: false, retry: "请用英文写，例如 Kitchen hand。" };
      d.titleEn = text[0].toUpperCase() + text.slice(1);
      return { ok: true, state: s, ack: `好，英文名是 ${d.titleEn}。` };
    }
    case "industry": {
      const hit = (Object.entries(INDUSTRY_LABELS) as [Industry, { zh: string; en: string }][]).find(
        ([, l]) => text.includes(l.zh) || text.toLowerCase().includes(l.en.toLowerCase()),
      );
      if (!hit) return { ok: false, retry: "请选一个行业。" };
      d.industry = hit[0];
      return { ok: true, state: s, ack: `好，行业是${hit[1].zh}。` };
    }
    case "pay":
      return setPay(s, text);
    case "hours": {
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
    case "region": {
      const id = readRegion(text, s.country);
      if (!id) return { ok: false, retry: "没找到这个区，可以点下面的地区。" };
      d.regionId = id;
      return { ok: true, state: s, ack: `好，地区是${regionById(s.country, id)?.nameZh}。` };
    }
    case "employmentType": {
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
    case "visa": {
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
    case "perks": {
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
    case "contact": {
      const found = readContact(text);
      if (!found.phone && !found.wechat && !found.email && /^[A-Za-z][-_A-Za-z0-9]{5,19}$/.test(text))
        found.wechat = text;
      if (!found.phone && !found.wechat && !found.email) {
        return { ok: false, retry: "没认出电话、微信号或邮箱，再发一次？例如 021 123 4567，或者微信号 abc_123。" };
      }
      d.contact = found;
      return {
        ok: true,
        state: s,
        ack: d.contactPublic ? "好，联系方式记下了，只有登录的求职者才能看到。" : "好，联系方式记下了。",
      };
    }
    case "review": {
      if (MAKE_PRIVATE.test(text) || MAKE_PUBLIC.test(text)) {
        d.contactPublic = !MAKE_PRIVATE.test(text);
        return { ok: true, state: s, ack: d.contactPublic ? "好，联系方式改为公开。" : "好，联系方式不公开。" };
      }
      if (!PREVIEW.test(text))
        return { ok: false, retry: "还有要改的吗？可以说「改一下时薪」，或者点「预览并发布」。" };
      s.ready = true;
      return { ok: true, state: s, ack: "好的，下面是求职者会看到的样子，确认后就能发布。" };
    }
  }
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

// ---- what to ask next ----

type Question = { topic: Topic; text: string; quickReplies?: QuickReply[]; fixing?: ChatState["fixing"] };

function proceed(state: ChatState, ack: string): ChatState {
  const s = clone(state);
  s.draft.descriptionEn = englishSummary(s.draft, s.country);
  if (s.asking === "rewrite" && s.fixing) return withMessage({ ...s }, "assistant", rewritePrompt(s), undefined);

  const findings = checkJob(s.draft, s.country);
  const notes = findings
    .filter((f) => f.level === "review" && !s.noted.includes(key(f)))
    .map((f) => {
      s.noted.push(key(f));
      return `提醒：${f.message_zh}`;
    });
  const q = nextQuestion(s, findings);
  s.asking = q.topic;
  s.fixing = q.fixing;
  return withMessage(s, "assistant", [ack, ...notes, q.text].filter(Boolean).join("\n"), q.quickReplies);
}

function nextQuestion(s: ChatState, findings: Finding[]): Question {
  const d = s.draft;
  const blocking = findings.find((f) => f.level !== "review");
  if (blocking) return fixQuestion(s, blocking);
  const missing = missingFields(d);
  if (missing.includes("titleZh")) return question(s, "title");
  if (missing.includes("titleEn")) return question(s, "titleEn");
  if (missing.includes("industry")) return question(s, "industry");
  if (missing.includes("pay")) return question(s, "pay");
  if (!d.hoursPerWeek && !s.asked.includes("hours")) return question(s, "hours");
  if (missing.includes("regionId")) return question(s, "region");
  if (missing.includes("employmentType") || s.unsure.includes("employmentType")) return question(s, "employmentType");
  if (!s.asked.includes("visa") && (!d.visaAccepted?.length || s.asking === "visa")) return question(s, "visa");
  if (d.mealsIncluded == null && d.accommodationIncluded == null && !s.asked.includes("perks"))
    return question(s, "perks");
  if (missing.includes("contact")) return question(s, "contact");
  if (missing.includes("descriptionZh"))
    return { topic: "rewrite", text: "再用一两句话描述一下这份工作？", fixing: { field: "descriptionZh" } };
  return question(s, "review");
}

const CHIP = (label: string, value?: string): QuickReply => (value ? { label, value } : { label });

function question(s: ChatState, topic: Topic): Question {
  const d = s.draft;
  const types = Object.entries(EMPLOYMENT_TYPE_LABELS) as [EmploymentType, { zh: string }][];
  switch (topic) {
    case "title":
      return { topic, text: "招的是什么职位？例如「厨房帮工」「收银员」。" };
    case "titleEn":
      return { topic, text: `「${d.titleZh}」英文怎么说？求职者页面会中英文对照，例如 Kitchen hand。` };
    case "industry":
      return { topic, text: "属于哪个行业？", quickReplies: Object.values(INDUSTRY_LABELS).map((l) => CHIP(l.zh)) };
    case "pay":
      return { topic, text: "时薪多少？写数字就行，例如 25 或 25-28。" };
    case "hours":
      return { topic, text: "每周大概多少小时？", quickReplies: ["20", "30", "40", "不固定"].map((v) => CHIP(v)) };
    case "region":
      return { topic, text: "在哪个区？", quickReplies: COUNTRIES[s.country].regions.map((r) => CHIP(r.nameZh)) };
    case "employmentType": {
      if (s.unsure.includes("employmentType") && d.employmentType) {
        const guess = formatEmploymentTypes(d.employmentType);
        const why = d.hoursPerWeek ? `每周 ${range(d.hoursPerWeek)} 小时` : "你的描述";
        return {
          topic,
          text: `我按${why}先当作${guess}，对吗？`,
          quickReplies: [
            CHIP("对"),
            ...types.filter(([t]) => !(d.employmentType ?? []).includes(t)).map(([, l]) => CHIP(l.zh)),
            CHIP("全职或兼职"),
            CHIP("都可以"),
          ],
        };
      }
      return {
        topic,
        text: "是全职、兼职还是临时工？可以接受多种。",
        quickReplies: [...types.map(([, l]) => CHIP(l.zh)), CHIP("全职或兼职"), CHIP("都可以")],
      };
    }
    case "visa": {
      const chosen = d.visaAccepted ?? [];
      const rest = COUNTRIES[s.country].visaTypes.filter((v) => !chosen.includes(v));
      return {
        topic,
        text: chosen.length
          ? `现在是：${chosen.map((v) => VISA_LABELS[v].zh).join("、")}。还有别的吗？`
          : "可以接受哪些签证？可以选几种。这里只写事实，不要写办签证、包签这类内容。",
        quickReplies: [
          ...rest.map((v) => CHIP(VISA_LABELS[v].zh)),
          ...(chosen.length ? [CHIP("就这些")] : [CHIP("都可以")]),
        ],
      };
    }
    case "perks":
      return {
        topic,
        text: "包餐或者包住吗？",
        quickReplies: ["包餐", "包住", "包吃住", "都不包"].map((v) => CHIP(v)),
      };
    case "contact":
      return { topic, text: "求职者怎么联系你？发电话、微信号或邮箱都行，只有登录的求职者才能看到。" };
    default:
      return {
        topic: "review",
        text: `都齐了：${summary(d)}。\n${contactChoice(d)}\n确认没问题就预览发布；想改哪里直接说，比如「改一下时薪」。`,
        quickReplies: [
          CHIP("预览并发布"),
          CHIP(d.contactPublic ? "不公开联系方式" : "公开联系方式"),
          CHIP("改一下时薪"),
          CHIP("改一下地区"),
        ],
      };
  }
}

const FIELD_WHERE: Record<TextField, string> = {
  titleZh: "职位名称里",
  titleEn: "英文职位名称里",
  descriptionZh: "描述里",
  shiftsZh: "班次里",
  address: "地址里",
};

function fixQuestion(s: ChatState, f: Finding): Question {
  if (f.rule === "min_wage") {
    return {
      topic: "fix",
      text: `${f.message_zh.replace(/，请调高后再发布。$/, "")}。时薪改成多少？`,
      fixing: { rule: f.rule, field: "descriptionZh" },
    };
  }
  const field = (f.field in FIELD_WHERE ? f.field : "descriptionZh") as TextField;
  const replies = [CHIP("删掉这句"), CHIP("我来改写")];
  if (f.rule === "ethnic_preference") replies.unshift(CHIP("改成「需会普通话」"));
  return {
    topic: "fix",
    text: `${FIELD_WHERE[field]}${f.message_zh}`,
    quickReplies: replies,
    fixing: { rule: f.rule, field, matches: f.matches },
  };
}

function rewritePrompt(s: ChatState): string {
  const field = s.fixing!.field;
  const now = s.draft[field];
  return `好，请把${FIELD_WHERE[field].replace("里", "")}重新写一下，我会替换掉原来的。${now ? `\n原来是：“${now}”` : ""}`;
}

// ---- 改一下时薪 ----

const CHANGE_VERB = /(改|修改|更改|换)/;
const TOPIC_WORDS: [Topic, RegExp][] = [
  ["pay", /时薪|工资|薪水|薪资/],
  ["hours", /工时|时间|小时/],
  ["region", /地区|区域|地点|在哪/],
  ["employmentType", /全职|兼职|临时|工作类型|类型/],
  ["visa", /签证|工签|学签|打工度假/],
  ["perks", /包餐|包住|包吃|吃住|福利/],
  ["contact", /联系|电话|微信|邮箱/],
  ["title", /职位|标题|岗位|名称/],
  ["rewrite", /描述|介绍/],
];

const CHANGE_PROMPTS: Record<Topic, string> = {
  pay: "好的，时薪改成多少？",
  hours: "好的，每周大概多少小时？",
  region: "好的，改到哪个区？",
  employmentType: "好的，改成哪种？",
  visa: "好的，重新选一下可以接受的签证。",
  perks: "好的，包餐包住怎么改？",
  contact: "好的，新的联系方式是？",
  title: "好的，职位名称改成什么？",
  rewrite: "好的，请重新描述一下这份工作，我会替换掉原来的描述。",
  titleEn: "好的，英文职位名称改成什么？",
  industry: "好的，改成哪个行业？",
  description: "",
  fix: "",
  review: "",
};

function changeIntent(text: string): { topic: Topic; value?: string } | undefined {
  if (!CHANGE_VERB.test(text)) return undefined;
  const hit = TOPIC_WORDS.find(([, re]) => re.test(text));
  if (!hit) return undefined;
  const value = text.split(/改成|改为|换成|改到|换到/)[1]?.trim();
  return { topic: hit[0], value: value || undefined };
}

/** Makes a topic askable again (hours, meals, visas are otherwise asked once). */
function reopen(state: ChatState, topic: Topic): ChatState {
  const s = clone(state);
  s.asked = s.asked.filter((t) => t !== topic);
  if (topic === "visa") s.draft.visaAccepted = [];
  if (topic === "rewrite") s.fixing = { field: "descriptionZh" };
  return s;
}

function askAbout(state: ChatState, topic: Topic, text: string): ChatState {
  const s = clone(state);
  const q = topic === "fix" || topic === "rewrite" || topic === "description" ? undefined : question(s, topic);
  s.asking = topic;
  const replies = topic === "fix" ? s.messages.findLast((m) => m.from === "assistant")?.quickReplies : q?.quickReplies;
  return withMessage(s, "assistant", text, replies);
}

// ---- text helpers ----

const CLAUSE = /([，,。；;！!\n])/;
const PAY_CLAUSE = /时薪|工资|薪水|薪资|\$\s*\d|\d+\s*(刀|纽币)|\/\s*(小时|h\b)/i;
const compact = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s*·•._~|\\/-]+/g, "");

/** The text without the sentences that hold any of `words` (or match `pattern`). */
function removeClauses(text: string, words: string[], pattern?: RegExp): string {
  const parts = text.split(CLAUSE);
  let out = "";
  for (let i = 0; i < parts.length; i += 2) {
    const clause = parts[i];
    const hit = words.some((w) => compact(clause).includes(compact(w))) || (pattern?.test(clause) ?? false);
    if (!hit) out += clause + (parts[i + 1] ?? "");
  }
  return out
    .replace(/^[，,。；;！!\s]+/, "")
    .replace(/[，,；;\s]+$/, "")
    .replace(/([，,])([。！!])/g, "$2");
}

function replaceWords(text: string, words: string[], by: string): string {
  let out = text;
  for (const w of words) out = out.split(w).join(by);
  return out === text ? `${removeClauses(text, words)}${removeClauses(text, words) ? "，" : ""}${by}` : out;
}

function numbers(text: string): number[] {
  return [...text.normalize("NFKC").matchAll(/\d+(?:\.\d{1,2})?/g)].map((m) => Number(m[0]));
}

function titleFields(text: string): Partial<JobDraft> {
  const t = readTitle(text);
  return { titleZh: t.titleZh ?? text, titleEn: t.titleEn, ...(t.industry && { industry: t.industry }) };
}

const money = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const range = (r: { min: number; max?: number }, f: (n: number) => string = String) =>
  r.max != null && r.max !== r.min ? `${f(r.min)}–${f(r.max)}` : f(r.min);

function payText(s: ChatState): string {
  return s.draft.pay ? `${COUNTRIES[s.country].currencySymbol}${range(s.draft.pay, money)}/小时` : "";
}

function perksText(d: JobDraft): string {
  if (d.mealsIncluded && d.accommodationIncluded) return "包吃住";
  if (d.mealsIncluded) return "包餐";
  if (d.accommodationIncluded) return "包住";
  return "不包吃住";
}

const contactKinds = (d: JobDraft) =>
  [d.contact?.phone && "电话", d.contact?.wechat && "微信", d.contact?.email && "邮箱"].filter(Boolean).join("、");

/** The employer's contact choice in one line, with how to change it (private unless they made it public). */
function contactChoice(d: JobDraft): string {
  const kinds = contactKinds(d);
  if (d.contactPublic) return `联系方式公开：登录的求职者能在职位页看到你的${kinds}。`;
  const given = kinds ? `你写的${kinds}不会显示，` : "";
  return `联系方式不公开：${given}求职者在聊天里申请交换，你同意后才给。交换用的资料在企业主页填写。想公开就点「公开联系方式」。`;
}

/** What the draft says so far, in one line. */
function summary(d: JobDraft): string {
  const country = d.country ?? "NZ";
  return [
    d.titleZh,
    d.pay && `${COUNTRIES[country].currencySymbol}${range(d.pay, money)}/小时`,
    d.regionId && regionById(country, d.regionId)?.nameZh,
    formatEmploymentTypes(d.employmentType),
    d.hoursPerWeek && `每周 ${range(d.hoursPerWeek)} 小时`,
    (d.mealsIncluded != null || d.accommodationIncluded != null) && perksText(d),
    d.visaAccepted?.length && `签证：${d.visaAccepted.map((v) => VISA_LABELS[v].zh).join("、")}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

const key = (f: Finding) => `${f.rule}:${f.field}`;

function clone(s: ChatState): ChatState {
  return {
    ...s,
    draft: { ...s.draft, ...(s.draft.contact && { contact: { ...s.draft.contact } }) },
    messages: [...s.messages],
    asked: [...s.asked],
    unsure: [...s.unsure],
    noted: [...s.noted],
    ...(s.fixing && { fixing: { ...s.fixing } }),
  };
}

function withMessage(
  state: ChatState,
  from: ChatMessage["from"],
  text: string,
  quickReplies?: QuickReply[],
): ChatState {
  const s = clone(state);
  const msg: ChatMessage = {
    id: `m${s.messages.length + 1}`,
    from,
    text,
    ...(quickReplies?.length && { quickReplies }),
  };
  s.messages.push(msg);
  return s;
}

/** Back from the preview to the conversation: ready again for changes. */
export function resumeChat(state: ChatState): ChatState {
  const s = { ...clone(state), ready: false, asking: "review" as const };
  const q = question(s, "review");
  return withMessage(s, "assistant", "还要改哪里？直接说，比如「改一下时薪」，或者点「预览并发布」。", q.quickReplies);
}

const TOPICS: Topic[] = [
  "description",
  "rewrite",
  "fix",
  "title",
  "titleEn",
  "industry",
  "pay",
  "hours",
  "region",
  "employmentType",
  "visa",
  "perks",
  "contact",
  "review",
];
const TEXT_FIELDS: TextField[] = ["titleZh", "titleEn", "descriptionZh", "shiftsZh", "address"];
const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 50) : [];

/**
 * A conversation sent back by the browser, rebuilt with known values only. The draft is cleaned by
 * the caller's own sanitizer (the server's), so this module keeps no server code.
 */
export function restoreChat(input: unknown, country: CountryCode, cleanDraft: (draft: unknown) => JobDraft): ChatState {
  const o = (typeof input === "object" && input) || {};
  const r = o as Record<string, unknown>;
  const messages = (Array.isArray(r.messages) ? r.messages : [])
    .slice(-200)
    .filter((m): m is Record<string, unknown> => typeof m === "object" && m != null && typeof m.text === "string")
    .map((m, i) => ({
      id: `m${i + 1}`,
      from: m.from === "employer" ? ("employer" as const) : ("assistant" as const),
      text: (m.text as string).slice(0, 4000),
      ...(Array.isArray(m.quickReplies) && {
        quickReplies: m.quickReplies
          .filter(
            (q): q is QuickReply => typeof q === "object" && q != null && typeof (q as QuickReply).label === "string",
          )
          .slice(0, 20)
          .map((q) => ({
            label: q.label.slice(0, 40),
            ...(typeof q.value === "string" && { value: q.value.slice(0, 2000) }),
          })),
      }),
    }));
  const f = r.fixing as Record<string, unknown> | undefined;
  const fixing =
    f && TEXT_FIELDS.includes(f.field as TextField)
      ? {
          field: f.field as TextField,
          ...(typeof f.rule === "string" && { rule: f.rule as RuleId }),
          ...(Array.isArray(f.matches) && { matches: strings(f.matches) }),
        }
      : undefined;
  return {
    country,
    draft: { ...cleanDraft(r.draft), country },
    messages: messages.length ? messages : startChat(country).messages,
    asking: TOPICS.includes(r.asking as Topic) ? (r.asking as Topic) : "description",
    ...(fixing && { fixing }),
    asked: strings(r.asked).filter((t): t is Topic => TOPICS.includes(t as Topic)),
    unsure: strings(r.unsure).filter((t): t is Topic => TOPICS.includes(t as Topic)),
    noted: strings(r.noted),
    ready: false,
  };
}
