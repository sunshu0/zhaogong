// Round 20 (ADR 0023): the home page — app/page.tsx, seeker/landing.ts, landing-parts.tsx, ChatReplay.tsx,
// WindowNotices.tsx, and the platform figures' words in config/landing.ts. What the replay and the before/after card
// show (chat-replay.ts, EMPLOYER_EXAMPLE) is a Chinese posting and the posting assistant's Chinese answers: AI posting
// stays Chinese in the first round (draft, 1), so only the frame around them is here. Figures arrive as numbers;
// the count-up animation draws them, and the words follow.

import type { Dictionary } from "@/i18n/messages";

/** Words after a figure that don't change with it (Chinese); English gives each count its own function. */
const sameFor =
  (words: string): ((n: number) => string) =>
  () =>
    words;

const homeZh = {
  // metadata
  title: "奥克兰的中文工作平台",
  description:
    "时薪、地区、签证一目了然；雇主经过验证，职位发布前检查最低工资和违规收费；联系方式只给登录的求职者，或在聊天中双方同意后交换。",
  hero: {
    // Two lines, broken after the first.
    line1: "奥克兰的中文工作，",
    line2: "时薪写在最前面。",
    lead: "餐饮、零售、清洁、装修。每个职位发布前都核对过最低工资，雇主有没有通过验证、接受哪些签证，都写得清清楚楚。",
    searchPlaceholder: "服务员、厨师、Mt Eden…",
    search: "搜索职位",
    submit: "找工作",
    quick: "快捷筛选",
    quickStudent: "接受学签",
    quickMeals: "包餐",
    quickPartTime: "兼职",
    quickCbd: "市中心",
    // 「找软件、电子电气方向的工作？看 实习 和 专业职位（来自公司官网）」, the two sections as links.
    externalBefore: "找软件、电子电气方向的工作？看",
    internships: "实习",
    and: "和",
    professional: "专业职位",
    externalAfter: "（来自公司官网）",
  },
  // heroCounts() and statLines(): the words after each figure, for that figure (English has one and many).
  counts: {
    openJobs: sameFor("个职位在招，来自"),
    verifiedEmployers: sameFor("家已验证雇主"),
    employersPosting: sameFor("家雇主发布过招聘"),
    jobsPosted: sameFor("个职位"),
    hiresConfirmed: sameFor("人通过这里找到工作"),
    contactViews: sameFor("次咨询雇主"),
  },
  stats: "平台数据",
  demoData: "演示数据",
  featured: {
    title: "精选工作",
    hint: "来自已验证雇主、正在招聘的职位，时薪高的在前。",
    all: "查看全部职位 →",
    browseAll: "浏览全部职位 →",
    loading: "正在加载精选工作",
    auckland: "奥克兰",
  },
  features: {
    title: "功能展示",
    aiTitle: "AI 对话发帖",
    aiText:
      "雇主粘贴一段微信招聘消息，助手一问一答补齐时薪、地区、工时、签证和联系方式；违规的说法当场指出，帮你改好。",
    checksTitle: "发布前合规检查",
    checksText: "低于最低工资不能发布；押金、介绍费、包签、限华人等说法会被拦下或要求改写。",
    trustTitle: "雇主验证与防骗",
    trustText:
      "核对过企业登记的雇主带认证标志；联系方式只给登录的人，或在聊天中双方同意后交换；每个职位都能举报，有人审核。",
    chineseTitle: "中文为主",
    chineseText: "中英文界面，职位中英文对照；求职者浏览、注册、联系雇主都不收费。",
  },
  // ChatReplay.tsx
  replay: {
    assistant: "找工发帖助手",
    tag: "真实对话回放",
    fromAssistant: "助手：",
    fromEmployer: "雇主：",
    again: "重新播放",
  },
  // landing-parts.tsx: the before/after card.
  beforeAfter: {
    before: "改前 · 微信群里的一段话",
    after: "改后 · 找工整理好的中英文职位",
    languages: (list: string) => `工作语言：${list}`,
    listJoin: "、",
    contact: "联系方式：登录后可见",
    caption: "一段微信招聘消息，由找工整理成中英文职位",
  },
  // WindowNotices.tsx: the shop-window notices; 招 is the red stamp.
  window: {
    label: "正在招聘",
    stamp: "招",
  },
  employers: {
    eyebrow: "给雇主",
    title: "招人？一分钟发布招聘",
    pointPaste: "粘贴微信群里的招聘消息，自动整理成中英文职位",
    pointChecks: "发布前自动检查最低工资和违规用词",
    pointShare: "一键复制到微信群、小红书和 Skykiwi",
    signUp: "注册雇主 →",
    whatTheyCanDo: "看看雇主能做什么",
  },
};

export const seekerHomeMessages: Dictionary<typeof homeZh> = { key: "seekerHome", zh: homeZh };
