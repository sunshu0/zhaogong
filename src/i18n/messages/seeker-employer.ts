// Round 20 (ADR 0023): the business page as job seekers see it — EmployerPublicPage.tsx and app/employers/[id]
// (title, loading, not-found). 「雇主主页」 as it reads today; step 1 makes it 「企业主页」 (导师决定 7), and this follows.
// The business's own words (name, about, address, contact name) are not translated.

import type { Dictionary } from "@/i18n/messages";

const employerZh = {
  title: (name: string) => `${name} · 雇主主页`,
  missing: "雇主不存在",
  loading: "加载雇主主页…",
  back: "← 找工作",
  eyebrow: (id: string) => `雇主主页 · 演示企业 · ID：${id}`,
  noRegion: "地区待补充",
  chooseJob: "选择岗位并沟通",
  noOpenJobs: "暂无在招岗位",
  seeVerification: "查看公司资质",
  edit: "编辑企业主页",
  about: "企业介绍",
  noAbout: "雇主尚未填写企业介绍。",
  address: "工作地址",
  contactName: "招聘联系人",
  languages: "沟通语言",
  contactHours: "联系时间",
  verification: "公司资质",
  legalName: "登记名称",
  accredited: "认证雇主",
  accreditedYes: "已认证（演示）",
  accreditedNone: "未提供认证信息",
  demoNote: "演示登记与资质数据；企业验证不代表对工作条件的担保。",
  manageVerification: "管理企业验证",
  openJobs: "在招岗位",
  openJobsCount: (n: number) => `${n} 个`,
  noJobs: "该雇主暂时没有招聘中的职位。",
  notFilled: "未填写",
  notFound: {
    title: "这个雇主不存在或已停用",
    others: "看看其他职位",
    body: "链接可能有误，或者这家雇主已经不在找工上招聘。",
  },
};

export const seekerEmployerMessages: Dictionary<typeof employerZh> = {
  zh: employerZh,
  en: {
    title: (name) => `${name} · Business page`,
    missing: "Employer not found",
    loading: "Loading the business page…",
    back: "← Find jobs",
    eyebrow: (id) => `Business page · Demo business · ID: ${id}`,
    noRegion: "No area yet",
    chooseJob: "Choose a job and chat",
    noOpenJobs: "No open jobs right now",
    seeVerification: "See business verification",
    edit: "Edit the business page",
    about: "About the business",
    noAbout: "The employer hasn't written about the business yet.",
    address: "Workplace address",
    contactName: "Hiring contact",
    languages: "Languages spoken",
    contactHours: "When to contact",
    verification: "Business verification",
    legalName: "Legal name",
    accredited: "Accredited employer",
    accreditedYes: "Accredited (demo)",
    accreditedNone: "No accreditation details given",
    demoNote:
      "Demo registration and verification details. Business verification doesn't guarantee the working conditions.",
    manageVerification: "Manage business verification",
    openJobs: "Open jobs",
    openJobsCount: (n) => String(n),
    noJobs: "This employer has no open jobs right now.",
    notFilled: "Not filled in",
    notFound: {
      title: "This employer doesn't exist or is no longer active",
      others: "See other jobs",
      body: "The link may be wrong, or this employer no longer hires on 找工.",
    },
  },
};
