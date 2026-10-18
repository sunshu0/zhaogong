// Round 20 (ADR 0023): 企业主页 (the Business page). Covers the read-only note in
// src/components/employer/employer-page.ts, the compliance-check hints in
// src/components/employer/employer-page-check.ts, and the Business page's editing UI: the employer side of
// src/components/seeker/ProfileWorkspace.tsx and the EmployerRequiredFields / EmployerOptionalFields of
// src/components/seeker/ProfileFields.tsx. The job-seeker side of those two components is not here.
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
      ethnic_preference: "不能按种族或国籍招人。需要中文能力的话，写「需会普通话」或「需会粤语」。",
    },
    /** The words the rule matched, as they appear inside a finding. */
    matchedWords: (words: readonly string[]) => words.map((word) => `「${word}」`).join(""),
    ruleFinding: (field: string, words: string, advice: string) => `${field}含有${words}：${advice}`,
    contactList: (contacts: readonly string[]) => contacts.join("、"),
    contactFinding: (field: string, contacts: string) =>
      `${field}写了联系方式（${contacts}）：企业主页没登录也能看到，联系方式只能在职位上设置（公开给登录的求职者，或在聊天里交换），请删掉。`,
  },

  /** The employer side of src/components/seeker/ProfileWorkspace.tsx. */
  editor: {
    title: "企业主页",
    autoSaveNote: "改动会自动保存到企业主页，团队里的人和求职者都看同一份。",
    notSaved: "企业主页没保存：",
    previewDescription: "求职者在职位和企业主页上看到这些",
    seePublicPage: "查看公开主页",
    keyItemsNote: "求职者最看重：",
    fieldsLegend: "企业主页",
    fieldsLegendReadOnly: "企业主页（只有管理员能改）",
    readOnlySuffix: "（只有管理员能改）",
    verification: "企业验证",
    manageVerification: "管理公司资质",
    privateDetailsNote: "这是你自己的，团队里每人一份，只存在这台设备上。",
    preview: {
      avatarFallback: "企",
      nameEmpty: "企业名称待填写",
      headlineEmpty: "招聘简介待填写",
      bioEmpty: "企业介绍待填写",
      location: "地区",
      contactName: "招聘联系人",
      factEmpty: "待填写",
    },
  },

  /** EmployerRequiredFields and EmployerOptionalFields in src/components/seeker/ProfileFields.tsx. */
  fields: {
    name: { label: "企业名称", placeholder: "企业或店铺名称" },
    bio: { label: "企业介绍", placeholder: "介绍企业、工作环境和团队…" },
    location: { label: "地区", placeholder: "例如：Mt Eden · Dominion Rd" },
    contactName: { label: "招聘联系人", placeholder: "例如：陈经理" },
    headline: { label: "招聘简介", placeholder: "例如：前厅、后厨招聘" },
    languages: { label: "语言", placeholder: "例如：普通话、英语" },
    availability: { label: "联系时间", placeholder: "例如：工作日 10:00–17:00" },
  },
};

export const employerPageMessages: Dictionary<typeof employerPageZh> = {
  zh: employerPageZh,
  en: {
    employerPage: {
      readOnlyNote: (admins) =>
        `Only an admin${admins.length ? ` (${admins.join(", ")})` : ""} can change the Business page. This is what job seekers see now. Your own contact details for swapping are still yours to fill in.`,
    },

    pageCheck: {
      fieldLabel: {
        name: "Business name",
        headline: "Hiring summary",
        bio: "About the business",
        location: "Area",
        contactName: "Contact person",
        languages: "Languages",
        availability: "When to contact you",
      },
      rule: {
        fee: "You can't charge job seekers a deposit, a finder's fee or any other fee. Please take it out.",
        visa_selling: "You can't sell a visa or promise to arrange one. Please take it out.",
        ethnic_preference:
          "You can't hire by race or nationality. If you need Chinese, write “Mandarin needed” or “Cantonese needed”.",
      },
      matchedWords: (words) => words.map((word) => `“${word}”`).join(", "),
      ruleFinding: (field, words, advice) => `${field} has ${words}: ${advice}`,
      contactList: (contacts) => contacts.join(", "),
      contactFinding: (field, contacts) =>
        `${field} has contact details (${contacts}). The Business page can be seen without signing in, so contact details go on the job only: public to signed-in job seekers, or swapped in a chat. Please take them out.`,
    },

    editor: {
      title: "Business page",
      autoSaveNote: "Changes are saved to the Business page as you type. Your team and job seekers see the same one.",
      notSaved: "The Business page wasn't saved:",
      previewDescription: "This is what job seekers see on your jobs and on the Business page",
      seePublicPage: "See the public page",
      keyItemsNote: "What job seekers look at most:",
      fieldsLegend: "Business page",
      fieldsLegendReadOnly: "Business page (only an admin can change it)",
      readOnlySuffix: " (only an admin can change it)",
      verification: "Business verification",
      manageVerification: "Manage business verification",
      privateDetailsNote: "These are your own. Everyone in the team has their own, kept only on this device.",
      preview: {
        avatarFallback: "B",
        nameEmpty: "Business name not filled in",
        headlineEmpty: "Hiring summary not filled in",
        bioEmpty: "Nothing about the business yet",
        location: "Area",
        contactName: "Contact person",
        factEmpty: "Not filled in",
      },
    },

    fields: {
      name: { label: "Business name", placeholder: "The business or shop name" },
      bio: { label: "About the business", placeholder: "The business, the workplace and the team…" },
      location: { label: "Area", placeholder: "For example: Mt Eden · Dominion Rd" },
      contactName: { label: "Contact person", placeholder: "For example: Ms Chen" },
      headline: { label: "Hiring summary", placeholder: "For example: hiring front of house and kitchen" },
      languages: { label: "Languages", placeholder: "For example: Mandarin, English" },
      availability: { label: "When to contact you", placeholder: "For example: weekdays 10 am to 5 pm" },
    },
  },
};
