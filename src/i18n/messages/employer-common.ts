// Round 20 (ADR 0023): the employer bits every employer page shares. Covers components/employer/EmployerGate.tsx,
// the employer home page app/employer/page.tsx, the error_zh texts of app/employer/actions.ts, the loading.tsx
// labels under app/employer/** (the candidates one is in employer-applicants) and the /employer page title.
// 企业验证 has its own dictionary (employer-verify.ts).
import type { Dictionary } from "@/i18n/messages";

const employerCommonZh = {
  /** EmployerGate.tsx */
  gate: {
    needsEmployer: "发布和管理招聘需要雇主身份，正在带你去开通……",
    noRedirect: "没有跳转？点这里",
    seekerNow: "你现在用的是求职者身份。发布和管理招聘要用雇主身份。",
    switchToEmployer: (business: string) => `切换为雇主（${business}）`,
  },

  /** app/employer/page.tsx */
  home: {
    title: "雇主发布招聘",
    description: "粘贴一段招聘消息，一分钟整理成中英文职位，发布前自动检查是否合规。",
    heading: "招中文员工，一分钟发好招聘",
    points: [
      "粘贴微信群里的招聘消息，自动整理成中英文职位",
      "发布前自动检查最低工资和违规用词，求职者更放心",
      "一键复制到 Skykiwi、小红书和微信群，带职位链接",
    ],
    cta: "一分钟发布招聘",
    ctaNote: "用邮箱开通雇主身份，不用设密码，开通后马上开始写。",
    linksLabel: "雇主常用",
    jobsLink: "职位管理",
    jobsDetail: "编辑、刷新、关闭",
    verifyLink: "企业验证",
    verifyDetail: "显示「已验证企业」标识",
  },

  /** app/employer/actions.ts: what a Server Function says when it refuses. */
  errors: {
    signedOut: "请先登录。",
    noIdentity: "需要先开通雇主身份。",
    banned: "账号已被停用，不能再修改职位。",
    jobNotFound: "找不到这个职位。",
    alreadyEnded: "这个职位已经结束或已被下架。",
    hiresAfterEnd: "职位结束后才能记录招到几人。",
    failsRulesNow: "这个职位不符合现在的发布规则，请先编辑。",
    cannotRefresh: (reason: string) => `不能刷新：${reason}`,
    cannotRenew: (reason: string) => `不能续期：${reason}`,
    chooseRenewDays: "请选择续期 14、30 或 60 天。",
    renewTooLong: (days: number) => `续期 ${days} 天会超过最远的截止日，请选短一些的。`,
    takenDown: "这个职位已被下架，不能修改。",
    notReady: "还有问题没处理或必填项没填。",
    verifyPending: "你已经有一份验证申请在审核中，审核员核对后会通知你。",
    verifyNzbnPending: "这个 NZBN 已经有一份验证申请在审核中。如果是你的公司，请联系我们。",
    verifyNzbnTaken: "这个 NZBN 已经被其他店铺验证。如果是你的公司，请联系我们。",
    verifyBanned: "账号已被停用，不能申请验证。",
    verifyAdminOnly: "只有团队管理员能申请企业验证，请找你们店的管理员。",
    verifyAlready: (badge: string) => `你的店铺已经是「${badge}」。`,
    verifyNzbnNotFound: "企业登记里没有这个 NZBN。",
    verifyNzbnRemoved: "这家公司在企业登记里已注销，不能用来验证。",
  },

  /** The labels of the skeletons under app/employer/**\/loading.tsx. */
  loading: {
    employer: "正在加载",
  },
};

export const employerCommonMessages: Dictionary<typeof employerCommonZh> = {
  key: "employerCommon",
  zh: employerCommonZh,
};
