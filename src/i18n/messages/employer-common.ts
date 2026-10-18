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
  zh: employerCommonZh,
  en: {
    gate: {
      needsEmployer: "Posting and managing jobs needs the employer role. Taking you there now…",
      noRedirect: "Nothing happening? Tap here",
      seekerNow: "You are using your job seeker role. Posting and managing jobs needs your employer role.",
      switchToEmployer: (business) => `Switch to employer (${business})`,
    },

    home: {
      title: "Post a job as an employer",
      description:
        "Paste a job message and get a Chinese and English job post in a minute, checked against the rules before it goes live.",
      heading: "Hire Chinese-speaking staff: post a job in a minute",
      points: [
        "Paste a job message from a WeChat group and get a job post in Chinese and English",
        "Checks the adult minimum wage and words against the rules before you post, so job seekers can trust it",
        "Copy it to Skykiwi, Xiaohongshu and WeChat groups in one tap, with a link to the job",
      ],
      cta: "Post a job in a minute",
      ctaNote: "Set up hiring with your email. No password needed, and you can start writing straight away.",
      linksLabel: "For employers",
      jobsLink: "My jobs",
      jobsDetail: "Edit, move to top, close",
      verifyLink: "Business verification",
      verifyDetail: 'Show the "Verified business" badge',
    },

    errors: {
      signedOut: "Sign in first.",
      noIdentity: "Set up hiring first.",
      banned: "This account is suspended, so it can no longer change jobs.",
      jobNotFound: "That job can't be found.",
      alreadyEnded: "This job has already ended or been taken down.",
      hiresAfterEnd: "You can record how many people you hired once the job has ended.",
      failsRulesNow: "This job does not meet the current posting rules. Edit it first.",
      cannotRefresh: (reason) => `Can't move it to the top: ${reason}`,
      cannotRenew: (reason) => `Can't renew it: ${reason}`,
      chooseRenewDays: "Choose 14, 30 or 60 days.",
      renewTooLong: (days) =>
        days === 1
          ? "Renewing for 1 day goes past the latest closing date. Choose a shorter one."
          : `Renewing for ${days} days goes past the latest closing date. Choose a shorter one.`,
      takenDown: "This job has been taken down, so it can't be changed.",
      notReady: "Some problems are not fixed yet, or a required field is empty.",
      verifyPending: "You already have a verification application under review. A moderator will let you know.",
      verifyNzbnPending:
        "There is already a verification application under review for this NZBN. If it is your business, contact us.",
      verifyNzbnTaken: "Another business is already verified with this NZBN. If it is your business, contact us.",
      verifyBanned: "This account is suspended, so it cannot apply for verification.",
      verifyAdminOnly: "Only a team admin can apply for business verification. Ask an admin of your business.",
      verifyAlready: (badge) => `Your business is already "${badge}".`,
      verifyNzbnNotFound: "That NZBN is not in the business register.",
      verifyNzbnRemoved: "This business is removed from the business register, so it can't be used for verification.",
    },

    loading: {
      employer: "Loading",
    },
  },
};
