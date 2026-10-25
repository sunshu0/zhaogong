// /safety 防骗指南 (S2, #390): the requests most common in job scams, each with what it is and what to do. Facts and
// reminders only, no legal advice and no company named; the wording was checked by the 找工 mentor (legal adviser)
// on 2026-10-25. The minimum wages come from the country's settings, so the page never goes stale.
import type { Dictionary } from "@/i18n/messages";

const safetyZh = {
  title: "防骗指南",
  intro:
    "刚到新西兰找工作，下面这几种要求最常见于骗局。遇到了，先别给钱、别给证件，举报这条职位（聊天里的举报目前只存在你自己的记录里，留作证据）。",
  fees: {
    heading: "先交钱才给工作",
    body: "押金、介绍费、入职费、培训费、服装费。正规雇主不会让你先交钱才录用你。对方要这类钱，就先别付，举报这条职位。",
  },
  visa: {
    heading: "花钱买签证或担保",
    body: "有人说交一笔钱就能拿到工作签证、雇主担保或「包过」。花钱买不来工作和签证担保。持牌的移民顾问或律师可以收服务费，但谁也不能保证签证一定批下来。",
    inz: "签证的事以新西兰移民局（Immigration New Zealand）官网为准",
    advisers: "移民顾问有没有牌照，可以在 Immigration Advisers Authority 网站上查",
  },
  tasks: {
    heading: "刷单、返利、垫付",
    body: "让你先垫钱下单、点赞、刷好评，再给「返利」或「佣金」。这不是工作，垫的钱多半拿不回来。",
  },
  documents: {
    heading: "要护照原件、银行卡密码或验证码",
    body: "雇主核对你能不能在新西兰工作，可以看你的护照或签证；不要把护照原件交给对方保管。任何人都不需要你的银行卡密码、网银登录或手机验证码。",
  },
  wage: {
    heading: "工资低于最低时薪",
    /** The adult rate, the starting-out and training rate, and the day both took effect, from the country's settings. */
    body: (adult: string, startingOut: string, since: string) =>
      `新西兰的成人最低时薪目前是每小时 ${adult}；部分 16–19 岁的人和学徒适用起步工资、培训工资，每小时 ${startingOut}（都是${since}起，适用条件和数字以 Employment New Zealand 公布的为准）。职位写的时薪低于这些数，在找工里举报这条职位；工资上的问题可以打 Employment New Zealand 的电话 0800 20 90 20。`,
    rates: "Employment New Zealand：最低工资标准",
  },
  notAdvice: "本页只是提醒，不是法律意见。",
};

export const safetyMessages: Dictionary<typeof safetyZh> = { key: "safety", zh: safetyZh };
