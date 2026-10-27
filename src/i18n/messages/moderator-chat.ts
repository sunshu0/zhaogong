// 审核员和雇主聊天 (#407, ADR 0046): the moderators' 聊天 group in /admin (ModeratorChats.tsx, the 和企业聊天 buttons,
// admin/chat-actions.ts) and the business's side in /messages (ModeratorThread.tsx, messages/moderator-chat-actions.ts).

import type { Dictionary } from "@/i18n/messages";

const moderatorChatZh = {
  // What the business sees for the moderators, whoever of them writes.
  name: "找工审核员",
  // Both sides
  logLabel: "消息记录",
  empty: "还没有消息。",
  emptyText: "请先写消息。",
  read: "已读",
  notRead: "未读",
  tooLong: (max: number) => `一条消息最多 ${max} 字。`,
  full: "这段对话的消息已经到上限，发不了了。请写信联系我们。",
  sendFailed: "没发出去，可能是网络断了。消息还在输入框里，请重试。",
  // The business's side (/messages)
  employer: {
    rowNote: "官方",
    label: "和找工审核员的对话",
    note: "找工审核员会在这里问你核实材料、说明处理结果。你团队里的人都能看到、都能回复。",
    gone: "这段对话已经没有了。",
    back: "返回会话列表",
  },
  // The moderators' side (/admin)
  admin: {
    group: "聊天",
    listLabel: "和企业的对话",
    listName: "对话列表",
    none: "还没有对话。在被举报的职位、企业验证申请或暂时封禁的企业那里点「和企业聊天」开一段。",
    pick: "选一段对话。",
    start: "和企业聊天",
    starting: "正在打开…",
    notFound: "找不到这家企业。",
    threadName: (employer: string) => `和「${employer}」的对话`,
    note: "企业看到的是「找工审核员」，看不到你的邮箱；每条消息都记下是哪位审核员发的。企业团队里的人都能看、能回，被封禁的企业也能。",
    teamSigned: (employer: string, name: string) => `${employer} · ${name}`,
    back: "返回会话列表",
    unread: (n: number) => `${n} 条未读`,
    you: "你",
    noMessages: "还没有消息",
  },
};

export const moderatorChatMessages: Dictionary<typeof moderatorChatZh> = {
  key: "moderatorChat",
  zh: moderatorChatZh,
};
