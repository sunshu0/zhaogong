// Round 20 (ADR 0023): the shared pieces — src/components/ui (nav.ts, HeaderNav, BottomNav, BottomSheet, MoreMenu,
// Select, Skeleton, VerificationBadge, PayReferenceBox), seeker/ChatDialog and CopyButton (ShareJob uses them too),
// PrintButton, SignInGate, and the site's frame: app/layout.tsx, error.tsx, global-error.tsx, not-found.tsx.
// The product name 找工 is not translated (glossary, 不翻译 2). 导师决定 4: the pay reference says it comes from jobs
// on 找工. 导师决定 8: 「我的」 is Me in the bottom bar until step 1 measures it.

import type { Dictionary } from "@/i18n/messages";

const jobsIn = (n: number, industry: string) => `${n} open ${industry} ${n === 1 ? "job" : "jobs"} on 找工`;

const uiZh = {
  // nav.ts, HeaderNav.tsx, BottomNav.tsx, MoreMenu.tsx
  nav: {
    jobs: "职位",
    findJobs: "找工作",
    chat: "聊天",
    chatUnread: (n: number) => `聊天，${n} 条未读消息`,
    mine: "我的",
    manage: "职位管理",
    post: "发布",
    candidates: "推荐人才",
    workspace: "工作台",
    main: "主导航",
    bottom: "底部导航",
    more: "更多",
  },
  close: "关闭",
  closeDialog: "关闭弹窗",
  any: "不限",
  copy: "复制",
  copied: "已复制",
  copyFailed: "复制失败",
  print: "打印 / 存为 PDF",
  signIn: "登录 / 注册",
  // Skeleton.tsx
  loading: "正在加载",
  loadingJobs: "正在加载职位",
  // VerificationBadge.tsx: one sentence per level. Facts only, no visa advice.
  verification: {
    accredited_employer: "已核对新西兰企业登记，并且是移民局的认证雇主（Accredited Employer）。",
    business_verified: "已核对新西兰企业登记（NZBN），不是移民局的认证雇主。",
    unverified: "还没有核对企业登记，联系前请自行确认雇主信息。",
  },
  // PayReferenceBox.tsx (and the hint from lib/pay-reference.ts). Amounts and the time come formatted.
  payReference: {
    title: "同类职位时薪",
    tooFew: (industry: string, count: number, min: number) =>
      `同类职位时薪：样本太少（平台上${industry}在招职位只有 ${count} 个，少于 ${min} 个），暂不显示。`,
    lowest: "最低",
    median: "中位数",
    highest: "最高",
    basis: (count: number, industry: string, updated: string) =>
      `根据平台上 ${count} 个在招的${industry}职位计算（职位时薪取范围中间值），不含外部数据，${updated}更新。`,
    belowMedian: "低于同类职位的中位数，可能比较难招到人。",
    wholeCity: (area: string) => `全${area}`,
    wholeAuckland: "全奥克兰",
  },
  // app/layout.tsx: the default title, the description and the footer.
  site: {
    title: "奥克兰中文工作",
    description: "奥克兰的中文工作信息：时薪、地区、签证要求一目了然，雇主经过验证。",
    city: "奥克兰",
    lawNote: "所有职位须符合当地法律：不低于最低工资，不收取任何费用，不以种族或国籍招人。",
  },
  // error.tsx, global-error.tsx, not-found.tsx
  error: {
    title: "页面出了点问题",
    body: "可能是网络不稳定，或者我们这边出了错。稍后再试一次；一直这样的话，请告诉我们。",
    retry: "重试",
    home: "回首页",
    appTitle: "找工暂时打不开",
    appBody: "可能是网络不稳定，或者我们这边出了错。稍后再试一次。",
  },
  notFound: {
    title: "这个页面不存在",
    body: "链接可能有误，或者内容已经下架。",
    findJobs: "找工作",
    home: "回首页",
  },
};

export const uiMessages: Dictionary<typeof uiZh> = {
  zh: uiZh,
  en: {
    nav: {
      jobs: "Jobs",
      findJobs: "Find jobs",
      chat: "Chat",
      chatUnread: (n) => `Chat, ${n} unread ${n === 1 ? "message" : "messages"}`,
      mine: "Me",
      manage: "My jobs",
      post: "Post a job",
      candidates: "Suggested candidates",
      workspace: "Workspace",
      main: "Main",
      bottom: "Bottom bar",
      more: "More",
    },
    close: "Close",
    closeDialog: "Close the dialog",
    any: "Any",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Couldn't copy",
    print: "Print / save as PDF",
    signIn: "Sign in or sign up",
    loading: "Loading",
    loadingJobs: "Loading jobs",
    verification: {
      accredited_employer:
        "New Zealand business registration checked, and an Immigration NZ accredited employer (Accredited Employer).",
      business_verified: "New Zealand business registration (NZBN) checked; not an Immigration NZ accredited employer.",
      unverified:
        "Business registration not checked yet. Check the employer's details yourself before you contact them.",
    },
    payReference: {
      title: "Pay for similar jobs",
      tooFew: (industry, count, min) =>
        `Pay for similar jobs: too few to show (only ${jobsIn(count, industry)}, fewer than ${min}).`,
      lowest: "Lowest",
      median: "Median",
      highest: "Highest",
      basis: (count, industry, updated) =>
        `Based on ${jobsIn(count, industry)} (each job counts the middle of its pay range), no outside data. Updated ${updated}.`,
      belowMedian: "Below the median for similar jobs, so it may be harder to find someone.",
      wholeCity: (area) => `All of ${area}`,
      wholeAuckland: "All of Auckland",
    },
    site: {
      title: "Chinese-speaking jobs in Auckland",
      description:
        "Jobs in Auckland for Chinese speakers: pay per hour, area and visas accepted at a glance, with verified employers.",
      city: "Auckland",
      lawNote:
        "Every job must follow New Zealand law: at least the minimum wage, no fees of any kind, and no hiring by race or nationality.",
    },
    error: {
      title: "Something went wrong on this page",
      body: "The network may be unsteady, or something went wrong on our side. Try again in a moment; if it keeps happening, tell us.",
      retry: "Try again",
      home: "Home",
      appTitle: "找工 can't open right now",
      appBody: "The network may be unsteady, or something went wrong on our side. Try again in a moment.",
    },
    notFound: {
      title: "This page doesn't exist",
      body: "The link may be wrong, or the content has been taken down.",
      findJobs: "Find jobs",
      home: "Home",
    },
  },
};
