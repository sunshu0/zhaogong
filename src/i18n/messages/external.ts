// Round 20 (ADR 0023): external jobs for job seekers and the shared labels — lib/external-jobs (labels.ts, review.ts,
// filter.ts), ExternalSectionPage.tsx, app/external/[id], TakedownNote.tsx and the /internships, /professional titles.
// Only our own labels are translated: titles, company names and the posting's place stay as the company wrote them.
// Dates go through format.ts; money stays in the posting's currency. Visa lines restate the posting, never advise.
// ExternalSectionPage.tsx and external/[id]/page.tsx were changed by A's #174: step 2 checks with A before wiring.

import type { Dictionary } from "@/i18n/messages";

const externalZh = {
  name: "外部职位",
  notStated: "原文未说明",
  sections: {
    internship: "实习",
    professional: "专业职位",
    internshipTitle: "实习和毕业生项目（软件、电子电气）",
    professionalTitle: "专业职位（软件、电子电气）",
    internshipIntro: "软件和电子电气领域的实习、毕业生项目，来自公司官网。",
    professionalIntro: "软件和电子电气领域的全职、合同岗位，来自公司官网。",
  },
  fields: { software: "软件", electrical: "电子电气" },
  kinds: {
    internship: "实习",
    graduate: "毕业生项目",
    full_time: "全职",
    part_time: "兼职",
    contract: "合同",
  },
  cities: {
    auckland: "奥克兰",
    wellington: "惠灵顿",
    christchurch: "基督城",
    hamilton: "汉密尔顿",
    dunedin: "但尼丁",
    nz_other: "新西兰其他地区",
  },
  visas: {
    citizen_or_resident: "原文写明：需要公民或居民身份",
    work_rights: "原文写明：需要有在新西兰工作的权利",
    sponsorship: "原文写明：可以担保工作签证",
    no_sponsorship: "原文写明：不提供签证担保",
  },
  degrees: { bachelor: "本科", master: "硕士", phd: "博士" },
  subjects: {
    computer_science: "计算机科学",
    software_engineering: "软件工程",
    computer_engineering: "计算机工程",
    electrical_engineering: "电气工程",
    electronic_engineering: "电子工程",
    mechatronics: "机电一体化",
    information_technology: "信息技术",
    mathematics: "数学",
    physics: "物理",
  },
  // For moderators (#112): why a job needs a look before it can show.
  flags: {
    other_citizenship: "要求其他国家的公民身份（例如美国出口管制岗位要求 U.S. person）",
    ethnicity: "提到种族或民族方面的要求",
  },
  // review.ts: why a moderator doesn't show a job, and the checks on the forms.
  hideReasons: {
    requirement: "有按国籍、种族招人的要求",
    wrong_field: "不是软件或电子电气岗位",
    wrong_facts: "提取的事实和原文不符",
    other: "其他",
  },
  reviewErrors: {
    pickReason: "请选一个不显示的理由。",
    otherNeedsNote: "选「其他」时请写明理由。",
    removed: "这个职位已经下架，不能通过。",
    checkFlags: (flags: readonly string[]) => `请先打开官网原文核对：${flags.join("；")}。`,
    reasonMissing: "请写明原因。",
    requesterMissing: "请写明是谁提出的（公司邮箱或部门）。",
    requestMissing: "请写明请求的内容和收到的日期。",
  },
  pay: {
    year: "每年",
    month: "每月",
    hour: "每小时",
    from: (min: string) => `${min} 起`,
    // e.g. $95,000–$110,000 NZD 每年
    line: (range: string, currency: string, per: string) => `${range} ${currency} ${per}`,
  },
  // The facts table on a job's page.
  facts: {
    field: "领域",
    kind: "类型",
    place: "地点",
    placeValue: (city: string, original: string) => `${city}（原文：${original}）`,
    closes: "截止日期",
    experience: "经验",
    noExperience: "不要求",
    years: (n: number) => `${n} 年以上`,
    degree: "学历",
    degreeWithSubjects: (degree: string, subjects: readonly string[]) =>
      `${degree}${subjects.length ? ` · ${subjects.join("、")}` : ""}`,
    visa: "签证",
    visaList: (lines: readonly string[]) => lines.join("；"),
    pay: "薪资",
  },
  source: (company: string, checkedOn: string) => `外部职位 · 来自 ${company} 官网 · 信息取于 ${checkedOn}`,
  filter: {
    label: "筛选",
    field: "领域",
    kind: "类型",
    experience: "经验要求",
    visa: "签证",
    area: "地区",
    withPay: "只看写了薪资的",
    submit: "筛选",
    experienceOptions: { le2: "2 年以内", ge3: "3 年以上", unstated: "原文未说明" },
    visaOptions: {
      sponsorship: "原文写明可以担保签证",
      required: "原文写明需要身份或工作权利",
      unstated: "原文未说明",
    },
  },
  list: {
    // Around the bold 外部职位 and two links: {intro}这些是 **外部职位** ：…也看看 <other section>、<普通工作>。
    introBefore: "这些是",
    introStrong: "外部职位",
    introAfter: "：不是雇主在找工发布的，我们只整理事实，申请请到公司官网。也看看",
    introAnd: "、",
    introEnd: "。",
    ordinaryJobs: "普通工作",
    loading: "正在加载职位",
    listLabel: (section: string) => `${section}列表`,
    found: (shown: number, total: number) => `找到 ${shown} 个，共 ${total} 个`,
    total: (total: number) => `共 ${total} 个，最新发布在前`,
    noMatch: "没有符合这些条件的职位。",
    // No job in the section at all (user feedback 10-30 #4).
    none: "这个栏目还在筹备，有职位了会显示在这里。",
    clear: "清除筛选",
    tags: "标签",
    closes: (date: string) => `截止 ${date}`,
    closesNotStated: (notStated: string) => `截止日期：${notStated}`,
    kindNotStated: (notStated: string) => `类型：${notStated}`,
  },
  job: {
    title: "外部职位",
    back: (section: string) => `← ${section}`,
    apply: "去官网申请（新窗口）",
    factsHeading: "职位信息（按官网原文整理）",
    factsNote: "只列原文写明的事实；签证一项只照录原文，不是签证建议。详细要求、职责和申请方式以官网为准。",
    applyNote: "申请直接交给公司，找工看不到也不经手你的申请。",
    // A demo job (isDemoCompany) has no company site: its 去官网申请 explains that instead (DemoApply).
    demoApply: "去官网申请",
    demoNote: "这是演示职位，没有真的官网申请页。真实职位会在新窗口打开公司官网的申请页面。",
  },
  // lib/external-jobs/alerts.ts: an alert on a section, its conditions in words and its first name.
  alerts: {
    kindNotStated: (notStated: string) => `类型${notStated}`,
    experience: (option: string) => `经验：${option}`,
    visa: (option: string) => `签证：${option}`,
    paid: "写了薪资",
    name: (section: string, conditions: readonly string[]) => `${section}：${conditions.join("、")}`,
    all: (section: string) => `全部${section}`,
  },
  takedown: {
    heading: "公司要求删除",
    text: "外部职位的信息来自各公司招聘系统公开的职位接口，只列事实，不转载原文，也不代表公司和找工有合作。公司不希望在这里出现，请联系我们，我们当天下架这家公司的全部职位。",
    email: "邮箱：",
    emailNote: "（请写明公司名和职位链接）",
    emailLater: "联系邮箱上线前公布。",
  },
};

export const externalMessages: Dictionary<typeof externalZh> = { key: "external", zh: externalZh };
