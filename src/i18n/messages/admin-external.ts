// Round 20 (ADR 0023): external jobs on the moderation pages — ExternalReview.tsx and external-actions.ts. The flag
// names and the reasons for not showing a job are in the external dictionary (lib/external-jobs), with the other
// external-job labels. Company names and terms checkers' names are never translated.

import type { Dictionary } from "@/i18n/messages";

const adminExternalZh = {
  name: "外部职位",
  intro:
    "外部职位从公司招聘系统的公开接口导入，只存事实，审核通过后才出现在「实习」「专业职位」里。请点「看官网原文」对照：事实提取错了、不是软件或电子电气岗位、或有按国籍或种族招人的要求，就选「不显示」。",
  // Shown while the demo's made-up external jobs are up (ExternalReviewQueue.demoJobs).
  demoJobs: (n: number) =>
    `这里有 ${n} 个演示用的假外部职位（不在名单里的公司，没有真的官网）：建演示库时没连上公司官网，或者这是测试数据。联网后运行 npm run import:external 导入真实职位，假职位会自动下架；新导入的职位要在这里审核通过才显示。`,
  pending: (n: number) => `待审核 ${n}`,
  noPending: "没有待审核的外部职位。",
  approvedHeading: (n: number) => `已通过 ${n}`,
  noApproved: "还没有通过的外部职位。",
  job: {
    label: (title: string) => `外部职位：${title}`,
    byDepartment: "按部门判断",
    showing: "正在显示",
    approvedHidden: "已通过，暂不显示",
    seen: (company: string, first: string, last: string) => `${company} · 首次导入 ${first} · 信息取于 ${last}`,
    whyHidden: "（超过 2 天没刷新到，或已过截止日）",
    byDepartmentNote: "职位名没说是软件还是电子电气，领域是按部门判断的，请在原文里核对。",
    checkOriginal: "需要核对原文：",
    flagsChecked: "我看过原文：这是岗位依法需要的要求（如出口管制），不是按国籍或种族挑人",
    original: "看官网原文（新窗口）",
    // In the place of 看官网原文 on a made-up company's job (#283).
    noOriginal: "这是演示用的假职位，没有官网原文。",
    hideLegend: "不显示的理由",
    note: "说明",
    noteOptional: "说明（选填）",
    confirmHide: "确定不显示",
    approve: "通过",
    hide: "不显示",
    takeOff: "撤下，不再显示",
  },
  companies: {
    title: "公司",
    description:
      "名单在 src/config/external-companies.ts，有人核对过条款、条款允许展示的公司才会导入。停用或记录删除请求后，这家的职位马上全部下架。",
    label: (name: string) => `外部公司：${name}`,
    importing: "导入中",
    removed: "已删除",
    stopped: "已停用",
    counts: (pending: number, shown: number) => `待审 ${pending} · 正在显示 ${shown}`,
    takedownOn: (date: string, requester: string) => `公司要求删除（${date}）：${requester}`,
    stoppedOn: (date: string, note: string) => `已停用（${date}）：${note}`,
    notListed: "不在名单里（演示数据）",
    termsChecked: (by: string, on: string) => `条款已核对：${by}，${on}`,
    termsForbid: (by: string, on: string) => `条款不允许展示（${by}，${on}）`,
    termsUnchecked: "条款还没核对，不导入",
    stopHeading: "停用这家公司",
    takedownHeading: "记录公司的删除请求",
    resumeHeading: "恢复导入",
    requester: "谁提出的（公司邮箱或部门，不写私人信息）",
    takedownNote: "请求内容和收到的日期",
    reason: "原因",
    confirmStop: "确定停用并下架",
    confirmTakedown: "记录并全部下架",
    confirmResume: "确定恢复",
    resume: "恢复导入",
    stop: "停用",
    takedown: "公司要求删除",
  },
  // external-actions.ts
  errors: {
    noJob: "找不到这个职位。",
    alreadyApproved: "这个职位已经通过了。",
    alreadyHidden: "这个职位已经不显示了。",
    noCompany: "找不到这家公司。",
    alreadyStopped: "这家公司已经停用了。",
    alreadyTakenDown: "这家公司的删除请求已经记录过了。",
    notStopped: "这家公司没有停用。",
  },
  // Notes the log keeps.
  log: {
    flagsChecked: "已核对原文中的特殊要求",
    reasonWithNote: (reason: string, note: string) => `${reason}：${note}`,
    requestBy: (requester: string, note: string) => `${requester}：${note}`,
  },
};

export const adminExternalMessages: Dictionary<typeof adminExternalZh> = { key: "adminExternal", zh: adminExternalZh };
