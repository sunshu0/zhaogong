// What the chat asks next: the first blocking problem, then what is missing or only guessed, then
// the review. Each question comes with its quick replies.
import { COUNTRIES } from "@/config/countries";
import { EMPLOYMENT_TYPE_LABELS, INDUSTRY_LABELS, VISA_LABELS } from "@/i18n/labels";
import { checkJob, type Finding } from "@/lib/compliance";
import type { EmploymentType } from "@/lib/types";
import { formatEmploymentTypes } from "@/lib/employment-types";
import { englishSummary, missingFields } from "./parse";
import {
  CHIP,
  clone,
  key,
  withMessage,
  type ChatState,
  type QuickReply,
  type TextField,
  type Topic,
} from "./chat-state";
import { contactChoice, range, summary } from "./chat-text";

type Question = { topic: Topic; text: string; quickReplies?: QuickReply[]; fixing?: ChatState["fixing"] };

export function proceed(state: ChatState, ack: string): ChatState {
  const s = clone(state);
  s.draft.descriptionEn = englishSummary(s.draft, s.country);
  if (s.asking === "rewrite" && s.fixing) return withMessage({ ...s }, "assistant", rewritePrompt(s), undefined);

  const findings = checkJob(s.draft, s.country, s.employer);
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

export function question(s: ChatState, topic: Topic): Question {
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
      const rest = COUNTRIES[s.country].visaTypes.filter(
        (v) => !chosen.includes(v) && (v !== "aewv" || s.employer?.verification === "accredited_employer"),
      );
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
  if (f.rule === "aewv_unaccredited") {
    return {
      topic: "fix",
      text: `签证里${f.message_zh}`,
      quickReplies: [CHIP(`去掉「${VISA_LABELS.aewv.zh}」`)],
      fixing: { rule: f.rule, field: "descriptionZh" },
    };
  }
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

export function askAbout(state: ChatState, topic: Topic, text: string): ChatState {
  const s = clone(state);
  const q = topic === "fix" || topic === "rewrite" || topic === "description" ? undefined : question(s, topic);
  s.asking = topic;
  const replies = topic === "fix" ? s.messages.findLast((m) => m.from === "assistant")?.quickReplies : q?.quickReplies;
  return withMessage(s, "assistant", text, replies);
}
