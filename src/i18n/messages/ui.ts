// Round 20 (ADR 0023): the shared pieces — src/components/ui (nav.ts, HeaderNav, BottomNav, BottomSheet, MoreMenu,
// Select, Skeleton, VerificationBadge, PayReferenceBox), seeker/ChatDialog and CopyButton (ShareJob uses them too),
// PrintButton, SignInGate, LoadFailed and the no-answer words (#246), and the site's frame: app/layout.tsx, error.tsx,
// global-error.tsx, not-found.tsx.
// The product name 找工 is not translated (glossary, 不翻译 2). 导师决定 4: the pay reference says it comes from jobs
// on 找工. 导师决定 8: 「我的」 is Me in the bottom bar until step 1 measures it.

import type { Dictionary } from "@/i18n/messages";

const uiZh = {
  // nav.ts, HeaderNav.tsx, BottomNav.tsx, MoreMenu.tsx
  nav: {
    jobs: "职位",
    findJobs: "找工作",
    internships: "实习",
    professional: "专业职位",
    // After a job section with no job yet (user feedback 10-30 #4).
    preparing: "筹备中",
    chat: "聊天",
    chatUnread: (n: number) => `聊天，${n} 条未读消息`,
    mine: "我的",
    manage: "职位管理",
    post: "发布",
    candidates: "推荐人才",
    workspace: "工作台",
    admin: "审核后台",
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
  // LangSwitch.tsx: the other language, written in itself, and what pressing it does.
  langSwitch: {
    other: "English",
    otherTag: "en",
    title: "切换到英文界面",
    row: "界面语言：中文",
    noAnswer: "网络有问题，没有切换，请稍后再试。",
  },
  // Skeleton.tsx
  loading: "正在加载",
  loadingJobs: "正在加载职位",
  // VerificationBadge.tsx: one sentence per level. Facts only, no visa advice.
  verification: {
    accredited_employer: "已核对新西兰企业登记，并且是移民局的认证雇主（Accredited Employer）。",
    business_verified: "已核对新西兰企业登记（NZBN），不是移民局的认证雇主。",
    unverified: "还没有核对企业登记，联系前请自行确认雇主信息。",
  },
  // VerificationBadge.tsx with `demo` (user feedback 10-30 #2): on the demo site's made-up businesses, instead of
  // the level, so nothing there reads as checked.
  demoBusiness: {
    label: "演示企业",
    explanation: "演示数据：这家店和它的职位是演示用的，不是真的在招人。",
    // Before a demo job's title and share text (the page title, the share card, 分享).
    prefix: "【演示】",
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
    // #340: the name by the header's mark.
    name: "找工",
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
  // #246: a Server Function call that got no answer (no network, the server restarting), on the employer and seeker
  // pages. LoadFailed.tsx: a load, said in its place with the page's own name for it; noAnswer: an action, said where
  // it was pressed.
  load: {
    notLoaded: (what: string) => `${what}没取到，可能是网络断了。`,
    retry: "重试",
    noAnswer: "网络有问题，请稍后再试。",
  },
  // ADR 0025 §7 (#319): the analytics consent prompt at the bottom of the page and its settings entry (the footer, 我的),
  // worded as the ADR has them. The prompt itself is line C's (the shared layout).
  consent: {
    body: "我们想用 Microsoft Clarity 记录页面上的点击和滚动，用来改进找工。页面文字和你输入的内容都会遮盖，不录聊天、简历和联系方式。同意后才开启，不同意也能照常使用。",
    agree: "同意",
    decline: "不用了",
    privacy: "隐私说明",
    settings: "统计设置",
    // #313: under the prompt when 统计设置 opens it again, what is set now.
    on: "现在：已同意。",
    off: "现在：没有开启。",
  },
};

export const uiMessages: Dictionary<typeof uiZh> = { key: "ui", zh: uiZh };
