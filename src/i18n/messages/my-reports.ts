// /me/reports 我的举报 (S2, #390, ADR 0041): the reports this device sent and whether each is still being handled.
// Two states only: the server knows a report is open, not how a closed one ended.
import type { Dictionary } from "@/i18n/messages";

const myReportsZh = {
  title: "我的举报",
  intro: "这里只列这台设备发过的举报。换设备、清掉浏览器数据或访客 cookie 以后，旧举报看不到，或者会显示成「已结束」。",
  jobs: "职位举报",
  noJobs: "这台设备还没有举报过职位。",
  open: "处理中",
  closed: "已结束（已处理，或审核员看过觉得没问题）",
  checking: "正在查状态…",
  unknown: "状态暂时查不到，稍后再看。",
  chats: "聊天里的举报",
  chatsNote: "只存在你的聊天记录里，还没有送交平台。",
  /** One chat report: who it was about. */
  chatAbout: (name: string) => `举报了 ${name}`,
  guide: "防骗指南：常见骗局和遇到了怎么办",
};

export const myReportsMessages: Dictionary<typeof myReportsZh> = { key: "myReports", zh: myReportsZh };
