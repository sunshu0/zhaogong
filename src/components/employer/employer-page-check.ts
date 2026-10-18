// 企业主页 must be fit to be public (#195): it is shown signed out too. Server side only (page-actions.ts): it
// pulls in the posting parser's contact patterns, which the browser does not need. Pure.
import { checkChatMessage, type ChatFinding } from "@/lib/compliance";
import { readContact } from "@/lib/ai-post/parse";
import type { CountryCode } from "@/lib/types";
import type { EmployerPage, EmployerPageField } from "@/components/employer/employer-page";

/** The labels of the page's text fields on /profile, so a finding names the field the employer sees. */
const FIELD_LABELS: Record<Exclude<EmployerPageField, "avatar">, string> = {
  name: "企业名称",
  headline: "招聘简介",
  bio: "企业介绍",
  location: "地区",
  contactName: "招聘联系人",
  languages: "语言",
  availability: "联系时间",
};

const RULE_TEXT: Record<ChatFinding["rule"], string> = {
  fee: "不能向求职者收取押金、介绍费或任何费用，请删除。",
  visa_selling: "不能出售或承诺办理签证，请删除。",
  ethnic_preference: "不能按种族或国籍招人。需要中文能力的话，写「需会普通话」或「需会粤语」。",
};

/** Something on the page that cannot be public (#195): which field, and what to change. */
export type PageFinding = { field: EmployerPageField; message_zh: string };

/**
 * What stops a page from being saved (#195): it is public, signed out too. The words a chat warns about (fees, visa
 * selling, ethnic preference), and contact details — those are for signed-in job seekers only, set on each job
 * (ADR 0002). Empty when the page can be saved.
 */
export function checkEmployerPage(page: EmployerPage, country: CountryCode = "NZ"): PageFinding[] {
  const findings: PageFinding[] = [];
  for (const field of Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[]) {
    const text = page[field];
    if (!text) continue;
    const label = FIELD_LABELS[field];
    for (const { rule, matches } of checkChatMessage(text, country)) {
      const words = matches.map((w) => `「${w}」`).join("");
      findings.push({ field, message_zh: `${label}含有${words}：${RULE_TEXT[rule]}` });
    }
    const contact = Object.values(readContact(text));
    if (contact.length)
      findings.push({
        field,
        message_zh: `${label}写了联系方式（${contact.join("、")}）：企业主页没登录也能看到，联系方式只能在职位上设置（公开给登录的求职者，或在聊天里交换），请删掉。`,
      });
  }
  return findings;
}
