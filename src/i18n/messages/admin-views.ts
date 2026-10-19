// #336 (ADR 0026): 查看记录 on the moderation pages — PersonalInfoViews.tsx and its tab in ModerationQueue.tsx. Line
// B's own dictionary, so the moderation dictionaries (line C's) stay as they are.

import type { Dictionary } from "@/i18n/messages";
import type { PersonalInfoKind } from "@/lib/personal-info-views";

const adminViewsZh = {
  tab: "查看记录",
  // On each 企业验证 card, after 提交于: the number 查看记录 lists it under.
  record: (id: string) => `编号 ${id}`,
  // The words LoadFailed puts before 没取到.
  name: "查看记录",
  title: "审核员看过谁的个人信息",
  description:
    "审核后台每次把别人的个人信息交给审核员（比如企业验证申请里的联系人和电话），都记一条：哪位审核员、什么时候、哪一类、哪条记录，不记内容。30 分钟内再看同一条只记一次。记录保留一年。",
  moderator: "审核员",
  everyone: "全部审核员",
  period: "时间",
  lastDays: (days: number) => (days === 365 ? "最近一年" : `最近 ${days} 天`),
  kinds: {
    verification: "企业验证申请",
    contact: "职位联系方式",
    profile: "求职者资料",
    chat: "聊天",
  } satisfies Record<PersonalInfoKind, string>,
  columns: { at: "时间", moderator: "审核员", kind: "哪一类", subject: "记录编号" },
  caption: (count: number) => `${count} 条记录，新的在前`,
  empty: "这段时间没有记录。",
  more: (limit: number) => `只显示最新的 ${limit} 条。缩短时间，或者只看一位审核员。`,
};

export const adminViewsMessages: Dictionary<typeof adminViewsZh> = { key: "adminViews", zh: adminViewsZh };
