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
  // moderation-stats.ts: a wait, rounded down.
  wait: {
    underAMinute: "不到 1 分钟",
    minutes: (n: number) => `${n} 分钟`,
    hours: (n: number) => `${n} 小时`,
    days: (n: number) => `${n} 天`,
    daysHours: (days: number, hours: number) => `${days} 天 ${hours} 小时`,
  },
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const adminStatsMessages: Dictionary<typeof adminStatsZh> = {
  zh: adminStatsZh,
  en: {
    name: "moderation stats",
    now: {
      label: "Moderation stats: now",
      jobs: "Jobs waiting for review",
      reports: "Reports not dealt with",
      verifications: "Business verifications waiting",
      external: "External jobs waiting for review",
      oldestWaited: (wait) => `Oldest waiting ${wait}`,
      noneWaiting: "None waiting",
    },
    weeks: {
      title: (weeks) => `Last ${weeks} weeks`,
      description:
        "New Zealand time, weeks from Monday. Handled: reports closed by a take-down, a dismissal or a ban; time is the median from report to close. Taken down includes jobs taken down with a ban.",
      caption: (weeks) =>
        `New reports, handled reports, median time to handle, jobs taken down and businesses banned, each week for the last ${weeks} weeks`,
      week: "Week",
      newReports: "New reports",
      handled: "Handled",
      time: "Time",
      takenDown: "Taken down",
      banned: "Banned",
      thisWeek: "This week",
      weekOf: (start) => `From ${start}`,
      untimed: (n) =>
        n === 1
          ? "1 more report was handled before handling times were recorded, so it isn't counted in the time."
          : `${n} more reports were handled before handling times were recorded, so they aren't counted in the time.`,
    },
    byModerator: {
      title: "By moderator",
      description: (weeks) =>
        `What each moderator did in the last ${weeks} weeks. A ban counts once, however many jobs it took down.`,
      none: (weeks) => `Nothing in the log for the last ${weeks} weeks.`,
      caption: (weeks) =>
        `Approvals, take-downs, dismissals, bans and business verifications by each moderator in the last ${weeks} weeks`,
      moderator: "Moderator",
      approve: "Approved",
      takeDown: "Taken down",
      dismiss: "Dismissed",
      ban: "Banned",
      verify: "Verification",
      external: "External jobs",
      total: "Total",
    },
    ai: {
      title: "Post with AI: usage",
      description: (days) =>
        `Calls to the model from posting by chat over the last ${days} days, New Zealand time. Tokens count input, output and cache; failed means an error, a refusal or an answer that couldn't be read; limited means stopped by the cap of 6 a minute and 100 a day per account, without calling the model.`,
      caption: (days) =>
        `Calls to the Post with AI model, tokens, failures and limited calls each day for the last ${days} days`,
      date: "Date",
      calls: "Calls",
      tokens: "Tokens",
      failed: "Failed",
      limited: "Limited",
      today: "Today",
      total: (days) => `${days}-day total`,
    },
    wait: {
      underAMinute: "under a minute",
      minutes: (n) => plural(n, "minute", "minutes"),
      hours: (n) => plural(n, "hour", "hours"),
      days: (n) => plural(n, "day", "days"),
      daysHours: (days, hours) => `${plural(days, "day", "days")} ${plural(hours, "hour", "hours")}`,
    },
  },
};
