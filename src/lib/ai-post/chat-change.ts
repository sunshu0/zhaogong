// 「改一下时薪」: an employer can go back to any earlier answer by saying what to change.
import { clone, type ChatState, type Topic } from "./chat-state";

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

export const CHANGE_PROMPTS: Record<Topic, string> = {
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

export function changeIntent(text: string): { topic: Topic; value?: string } | undefined {
  if (!CHANGE_VERB.test(text)) return undefined;
  const hit = TOPIC_WORDS.find(([, re]) => re.test(text));
  if (!hit) return undefined;
  const value = text.split(/改成|改为|换成|改到|换到/)[1]?.trim();
  return { topic: hit[0], value: value || undefined };
}

/** Makes a topic askable again (hours, meals, visas are otherwise asked once). */
export function reopen(state: ChatState, topic: Topic): ChatState {
  const s = clone(state);
  s.asked = s.asked.filter((t) => t !== topic);
  if (topic === "visa") s.draft.visaAccepted = [];
  if (topic === "rewrite") s.fixing = { field: "descriptionZh" };
  return s;
}
