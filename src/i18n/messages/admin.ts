// Round 20 (ADR 0023): the moderation pages' frame, queue and moderators — page.tsx, ModerationQueue.tsx,
// ModeratorList.tsx, Failed.tsx, Empty.tsx, Cancel.tsx, actions.ts, moderator.ts, enabled.ts and moderation.ts (the
// log's sentences and the rule names). Verification, stats and external jobs have their own dictionaries.
// English per the glossary: a moderator reviews; 驳回 is "dismiss" for reports.

import type { Dictionary } from "@/i18n/messages";

const adminZh = {
  title: "审核后台",
  loading: "正在加载",
  signInFor: "登录后进入审核后台",
  // Around the command (kept as it is): 只有审核员能使用审核后台。第一位审核员在服务器上用 <code> 添加，…
  whoBefore: "只有审核员能使用审核后台。第一位审核员在服务器上用",
  whoCommand: "npm run admin:grant 邮箱",
  whoAfter: "添加，之后由审核员在「审核员」一页里增删。",
  access: {
    signedOut: "请先登录。",
    notModerator: "只有审核员能使用审核后台。",
  },
  // Failed.tsx (#183), Cancel.tsx
  tryAgain: "没成功，请重试。",
  notLoaded: (what: string) => `${what}没取到，可能是网络断了。`,
  retry: "重试",
  cancel: "取消",
  tabs: {
    label: "审核队列",
    flagged: "发布时被标记",
    reported: "被举报",
    verification: "企业验证",
    external: "外部职位",
    log: "操作记录",
    stats: "审核数据",
    moderators: "审核员",
  },
  queue: {
    done: (what: string) => `已处理：${what}`,
    // The words LoadFailed puts before 没取到.
    queueName: "审核队列",
    statsName: "审核数据",
    noLog: "还没有处理记录。",
    by: (moderator: string) => `操作人：${moderator}`,
    reportsOnlyJobs: "这里只收录对职位的举报，聊天里的举报不在这里。",
    noFlagged: "没有待审核的职位。",
    noReports: "没有待处理的举报。",
    banned: "已封禁",
    posted: (when: string) => `发布于 ${when}`,
    reportCount: (n: number) => `${n} 条举报`,
    // Between a report's reason and what the reporter wrote.
    noteSeparator: "：",
    ruleChecks: "规则检查",
    dismiss: "驳回举报",
    approve: "没问题，通过",
    takeDown: "下架",
    ban: "封禁雇主",
    confirmBan: (employer: string) => `确定封禁「${employer}」并下架全部职位`,
  },
  moderators: {
    listName: "审核员名单",
    heading: (n: number) => `审核员 · ${n} 位`,
    description: "审核员可以处理被标记和被举报的职位、封禁雇主，也可以增删审核员。",
    you: "（你）",
    keepOne: "至少要留一位审核员",
    removeLabel: (email: string) => `移除审核员 ${email}`,
    remove: "移除",
    // #249: 移除 asks first; for one's own row it says what follows.
    confirmLabel: (email: string) => `确认移除审核员 ${email}`,
    confirm: (email: string) => `移除 ${email} 的审核员身份？`,
    confirmSelf: "移除你自己的审核员身份？移除后你就不能再进审核后台，要请别的审核员重新添加。",
    confirmRemove: "确认移除",
    addHeading: "添加审核员",
    emailLabel: "邮箱",
    emailPlaceholder: "对方登录用的邮箱",
    add: "添加",
    addNote: "对方要先用这个邮箱登录过一次。",
    addedOnServer: "在服务器上添加",
    addedByDeleted: "由已删除的账号添加",
    addedBy: (email: string) => `由${email}添加`,
  },
  // actions.ts: answers to the moderator's buttons.
  errors: {
    notPending: "这个职位不在待审核列表里。",
    employerBanned: "雇主已被封禁，不能通过。",
    stillBlocked: "这个职位仍有不能发布的问题，只能下架。",
    noJob: "找不到这个职位。",
    noReports: "这个职位没有待处理的举报。",
    noEmployer: "找不到这个雇主。",
    alreadyBanned: "这个雇主已经被封禁。",
    invalidEmail: "请输入正确的邮箱地址。",
    noAccount: "这个邮箱还没有注册。请对方先用这个邮箱登录一次。",
    alreadyModerator: "这个账号已经是审核员。",
    lastModerator: "至少要留一位审核员，不能移除最后一位。",
    notModerator: "这个账号不是审核员。",
  },
  added: (email: string) => `添加审核员 ${email}`,
  removed: (email: string) => `移除审核员 ${email}`,
  // moderation.ts: the names of the checks run when a job is posted.
  rules: {
    min_wage: "低于成人最低工资",
    fee: "收费用词",
    visa_selling: "卖签证用词",
    ethnic_preference: "按种族或国籍招人",
    high_risk: "高风险行业",
    aewv_unaccredited: "非认证雇主招 AEWV",
  },
  // moderation.ts: one log line. `why` and `note` come in already made (or empty) from the helpers here.
  log: {
    oldEntry: "（较早的记录，未记审核员）",
    deletedModerator: "已删除的审核员",
    job: (title: string, employer: string) => `「${title}」（${employer}）`,
    reasons: (labels: readonly string[]) => ` · 举报：${labels.join("、")}`,
    rules: (labels: readonly string[]) => ` · 标记：${labels.join("、")}`,
    note: (note: string) => ` · ${note}`,
    approve: (job: string, why: string) => `审核通过${job}${why}`,
    takeDown: (job: string, why: string) => `下架${job}${why}`,
    dismiss: (job: string, why: string) => `驳回对${job}的举报${why}`,
    ban: (employer: string, n: number) => `封禁雇主「${employer}」，下架 ${n} 个职位`,
    verifyApprove: (employer: string, note: string) => `通过企业验证「${employer}」${note}`,
    verifyReject: (employer: string, note: string) => `驳回企业验证「${employer}」${note}`,
    externalApprove: (job: string) => `通过外部职位${job}`,
    externalHide: (job: string, note: string) => `不显示外部职位${job}${note}`,
    externalStop: (company: string, n: number, note: string) => `停用外部公司「${company}」，下架 ${n} 个职位${note}`,
    externalResume: (company: string, note: string) => `恢复导入外部公司「${company}」${note}`,
    externalTakedown: (company: string, n: number, note: string) =>
      `公司要求删除「${company}」，下架 ${n} 个职位${note}`,
  },
};

export const adminMessages: Dictionary<typeof adminZh> = { key: "admin", zh: adminZh };
