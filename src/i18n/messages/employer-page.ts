// Round 20 (ADR 0023): 企业主页 (the Business page). Covers the read-only note in
// src/components/employer/employer-page.ts and the compliance-check hints in
// src/components/employer/employer-page-check.ts. The page's editing words (ProfileWorkspace, ProfileFields) are
// line A's seeker-profile dictionary.
import type { Dictionary } from "@/i18n/messages";

const employerPageZh = {
  /** src/components/employer/employer-page.ts */
  employerPage: {
    /** Why a member sees the page read-only, naming the admins who can change it. */
    readOnlyNote: (admins: readonly string[]) =>
      `企业主页只有管理员${admins.length ? `（${admins.join("、")}）` : ""}能改。这里显示的是求职者现在看到的样子；你的私密交换资料还是自己填。`,
  },

  /** src/components/employer/employer-page-check.ts: what stops a page from being saved (#195). */
  pageCheck: {
    fieldLabel: {
      name: "企业名称",
      headline: "招聘简介",
      bio: "企业介绍",
      location: "地区",
      contactName: "招聘联系人",
      languages: "语言",
      availability: "联系时间",
    },
    rule: {
      fee: "不能向求职者收取押金、介绍费或任何费用，请删除。",
      visa_selling: "不能出售或承诺办理签证，请删除。",
      task_scam: "刷单、垫付返利这类「任务」不是工作，请删除。",
      ethnic_preference: "不能按种族或国籍招人。需要中文能力的话，写「需会普通话」或「需会粤语」。",
    },
    /** The words the rule matched, as they appear inside a finding. */
    matchedWords: (words: readonly string[]) => words.map((word) => `「${word}」`).join(""),
    ruleFinding: (field: string, words: string, advice: string) => `${field}含有${words}：${advice}`,
    contactList: (contacts: readonly string[]) => contacts.join("、"),
    contactFinding: (field: string, contacts: string) =>
      `${field}写了联系方式（${contacts}）：企业主页没登录也能看到，联系方式只能在职位上设置（公开给登录的求职者，或在聊天里交换），请删掉。`,
  },
};

export const employerPageMessages: Dictionary<typeof employerPageZh> = { key: "employerPage", zh: employerPageZh };
