// Round 20 (ADR 0023): moderation stats — ModerationStats.tsx and moderation-stats.ts (how long things waited).
// Dates and weekdays go through format.ts in the page's language; the words around them are here.

import type { Dictionary } from "@/i18n/messages";

const adminStatsZh = {
  name: "审核数据",
  now: {
    label: "审核数据：现在",
    jobs: "待审核的职位",
    reports: "未处理的举报",
    verifications: "待审核的企业验证",
    external: "待审核的外部职位",
    oldestWaited: (wait: string) => `最早的等了 ${wait}`,
    noneWaiting: "没有在等的",
  },
  weeks: {
    title: (weeks: number) => `最近 ${weeks} 周`,
    description:
      "按新西兰时间，每周从周一算起。处理：下架、驳回或封禁时关闭的举报；用时是从提交到关闭的中位数。下架含封禁时一起下架的职位。",
    caption: (weeks: number) => `最近 ${weeks} 周每周的新举报、处理的举报、处理用时中位数、下架职位和封禁企业`,
    week: "周",
    newReports: "新举报",
    handled: "处理",
    time: "用时",
    takenDown: "下架",
    banned: "封禁",
    thisWeek: "本周",
    weekOf: (start: string) => `${start}起`,
    untimed: (n: number) => `另有 ${n} 条举报在开始记录处理时间之前就处理完了，不计入用时。`,
  },
  byModerator: {
    title: "按审核员",
    description: (weeks: number) => `最近 ${weeks} 周每位审核员做的处理。封禁一次算一次，不按下架的职位数算。`,
    none: (weeks: number) => `最近 ${weeks} 周没有处理记录。`,
    caption: (weeks: number) => `最近 ${weeks} 周每位审核员的通过、下架、驳回、封禁和企业验证次数`,
    moderator: "审核员",
    approve: "通过",
    takeDown: "下架",
    dismiss: "驳回",
    ban: "封禁",
    verify: "企业验证",
    external: "外部职位",
    total: "合计",
  },
  ai: {
    title: "AI 发帖用量",
    description: (days: number) =>
      `最近 ${days} 天对话发布调用模型的次数，按新西兰时间。token 含输入、输出和缓存；失败是出错、被拒或读不出答案；超限是每个账号每分钟 6 次、每天 100 次的上限挡下的，没有调用模型。`,
    caption: (days: number) => `最近 ${days} 天每天调用 AI 发帖模型的次数、token、失败和超限次数`,
    date: "日期",
    calls: "调用",
    tokens: "token",
    failed: "失败",
    limited: "超限",
    today: "今天",
    total: (days: number) => `${days} 天合计`,
  },
  // Funnels.tsx (#316, ADR 0025 §5): the anonymous events' flows.
  funnels: {
    title: "漏斗",
    description:
      "按新西兰日期：同一位访客同一天走到的步骤串起来，跨天不串。人数是访客数，一天算一次。少于 5 的格子显示「少于 5」；转化率是占第一步的比例，两边都不少于 5 才显示。数据只在自己的库里，不含账号和邮箱。",
    name: "漏斗数据",
    period: "时间",
    lastDays: (n: number) => `最近 ${n} 天`,
    breakdown: "分开看",
    breakdowns: { all: "全部", lang: "按语言", role: "按身份" },
    groups: { all: "访客", zh: "中文页面", en: "英文页面", out: "未登录", seeker: "求职者", employer: "雇主" },
    step: "步骤",
    few: "少于 5",
    rate: (n: number) => `${n}%`,
    caption: (flow: string, days: number) => `${flow}：最近 ${days} 天每一步的访客数`,
    flows: {
      seek: "求职：从职位到联系雇主",
      external: "求职：外部职位",
      post: "雇主：发布职位",
      signin: "登录",
    },
    steps: {
      seek: ["首页或职位列表", "打开职位", "发起聊天或打开申请", "提交申请"],
      external: ["实习或专业职位列表", "外部职位页", "去官网申请"],
      post: ["打开发布页", "选了发布方式", "走到核对", "发布成功"],
      signin: ["打开登录页", "发了验证码", "登录成功"],
    },
    singlesTitle: "单独看",
    singles: { jobs_search: "用了职位筛选", applicants_view: "雇主看了申请人" },
  },
  // moderation-stats.ts: a wait, rounded down.
  wait: {
    underAMinute: "不到 1 分钟",
    minutes: (n: number) => `${n} 分钟`,
    hours: (n: number) => `${n} 小时`,
    days: (n: number) => `${n} 天`,
    daysHours: (days: number, hours: number) => `${days} 天 ${hours} 小时`,
  },
};

export const adminStatsMessages: Dictionary<typeof adminStatsZh> = { key: "adminStats", zh: adminStatsZh };
