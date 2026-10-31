// Round 20 (ADR 0023): the business page as job seekers see it — EmployerPublicPage.tsx and app/employers/[id]
// (title, loading, not-found). One name for the page everywhere: 「企业主页」 (导师决定 7, step 1).
// The business's own words (name, about, address, contact name) are not translated.

import type { Dictionary } from "@/i18n/messages";

const employerZh = {
  title: (name: string) => `${name} · 企业主页`,
  missing: "雇主不存在",
  loading: "加载企业主页…",
  back: "← 找工作",
  // 演示企业 only on the demo data (user feedback 10-30 #2); the internal id is never shown (UI review 3).
  eyebrow: (demo: boolean) => (demo ? "企业主页 · 演示企业" : "企业主页"),
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
  accreditedYes: "已认证",
  accreditedNone: "未提供认证信息",
  verificationNote: (demo: boolean) =>
    demo ? "演示登记与资质数据；企业验证不代表对工作条件的担保。" : "企业验证不代表对工作条件的担保。",
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

export const seekerEmployerMessages: Dictionary<typeof employerZh> = { key: "seekerEmployer", zh: employerZh };
