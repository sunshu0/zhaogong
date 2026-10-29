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
  whoBefore:
    "只有审核员能使用审核后台。管理员在服务器配置里设定，由管理员在「审核员」一页里增删审核员；也可以在服务器上用",
  whoCommand: "npm run admin:grant 邮箱",
  whoAfter: "添加。",
  access: {
    signedOut: "请先登录。",
    notModerator: "只有审核员能使用审核后台。",
  },
  // Failed.tsx (#183), Cancel.tsx
  tryAgain: "没成功，请重试。",
  notLoaded: (what: string) => `${what}没取到，可能是网络断了。`,
  retry: "重试",
  cancel: "取消",
  // ADR 0043: the page in two groups, what waits first.
  groups: {
    label: "审核后台分组",
    todo: "待处理",
    records: "记录与统计",
  },
  tabs: {
    label: "审核队列",
    flagged: "发布时被标记",
    reported: "被举报",
    verification: "企业验证",
    external: "外部职位",
    log: "操作记录",
    stats: "审核数据",
    moderators: "审核员",
    changes: "审核员变动记录",
    tempBans: "暂时封禁",
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
    tempBanned: (until: string) => `暂时封禁到 ${until}`,
    banLegend: (employer: string) => `封禁「${employer}」`,
    banTemp: (days: number) => `暂时封禁 ${days} 天`,
    banPermanent: "永久封禁，下架全部职位",
    banReason: (max: number) => `原因（雇主的团队会看到，最多 ${max} 字）`,
    confirmTempBan: (employer: string, days: number) => `确定暂时封禁「${employer}」${days} 天`,
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
    description:
      "审核员处理被标记和被举报的职位，可以封禁雇主。管理员在服务器配置里设定，只有管理员能添加、移除审核员。",
    descriptionViewOnly:
      "审核员处理被标记和被举报的职位，可以封禁雇主。只有管理员能添加、移除审核员，这里只能查看名单。",
    you: "（你）",
    adminTag: "管理员",
    adminFromSettings: "在服务器配置里设定，不能在这里移除",
    noModerators: "还没有管理员以外的审核员。",
    removeLabel: (email: string) => `移除审核员 ${email}`,
    remove: "移除",
    // #249: 移除 asks first; for one's own row it says what follows.
    confirmLabel: (email: string) => `确认移除审核员 ${email}`,
    confirm: (email: string) => `移除 ${email} 的审核员身份？`,
    confirmRemove: "确认移除",
    addHeading: "添加审核员",
    emailLabel: "邮箱",
    emailPlaceholder: "对方登录用的邮箱",
    add: "添加",
    addNote:
      "对方要先用这个邮箱登录过一次。请用专门的审核员邮箱：已经有简历、申请、收藏、职位提醒或雇主身份的邮箱不能添加。",
    addedOnServer: "在服务器上添加",
    addedByDeleted: "由已删除的账号添加",
    addedBy: (email: string) => `由${email}添加`,
  },
  // TempBans.tsx (ADR 0044): the businesses under a temporary ban, under 记录与统计.
  tempBans: {
    listName: "暂时封禁的企业",
    title: "暂时封禁",
    description: "正在暂时封禁的企业，最先到期的在前。到期自动恢复，不用处理。",
    empty: "现在没有暂时封禁的企业。",
    until: (when: string) => `到 ${when}`,
    reason: (reason: string) => `原因：${reason}`,
    by: (email: string) => `封禁的人：${email}`,
    lift: "提前解除",
    makePermanent: "改成永久",
    confirmPermanent: (employer: string) => `确定永久封禁「${employer}」并下架全部职位`,
  },
  // ModeratorChanges.tsx (ADR 0043): who added and removed moderators, for the admins.
  changes: {
    listName: "审核员变动记录",
    title: "审核员变动记录",
    description: "每次添加、移除审核员都记在这里，只有管理员能看。",
    empty: "还没有添加或移除过审核员。",
    grant: (email: string) => `添加审核员 ${email}`,
    revoke: (email: string) => `移除审核员 ${email}`,
    by: (who: string) => `操作人：${who}`,
    commandLine: "命令行",
    deleted: "已删除的账号",
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
    banDays: "暂时封禁只能选 3 天、7 天或 30 天。",
    banReasonMissing: "请写明封禁的原因，雇主会看到。",
    banReasonTooLong: (max: number) => `原因最多 ${max} 个字。`,
    notTempBanned: "这家企业现在没有被暂时封禁。",
    invalidEmail: "请输入正确的邮箱地址。",
    noAccount: "这个邮箱还没有注册。请对方先用这个邮箱登录一次。",
    alreadyModerator: "这个账号已经是审核员。",
    notModerator: "这个账号不是审核员。",
    // ADR 0043: admins only, a clean address, and admins come from the configuration.
    adminOnly: "只有管理员能添加、移除审核员。",
    hasData: "这个邮箱已经有求职或招聘的数据。请用一个专门的审核员邮箱。",
    isAdmin: "管理员在服务器配置里设定，不能在这里移除。",
  },
  added: (email: string) => `添加审核员 ${email}`,
  removed: (email: string) => `移除审核员 ${email}`,
  // moderation.ts: the names of the checks run when a job is posted.
  rules: {
    min_wage: "低于成人最低工资",
    fee: "收费用词",
    visa_selling: "卖签证用词",
    task_scam: "刷单用词",
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
    tempBan: (employer: string, days: number, note: string) => `暂时封禁雇主「${employer}」${days} 天${note}`,
    unban: (employer: string) => `提前解除对雇主「${employer}」的暂时封禁`,
    makePermanent: (employer: string, n: number) => `把对雇主「${employer}」的暂时封禁改成永久，下架 ${n} 个职位`,
    verifyApprove: (employer: string, note: string) => `通过企业验证「${employer}」${note}`,
    verifyReject: (employer: string, note: string) => `驳回企业验证「${employer}」${note}`,
    externalApprove: (job: string) => `通过外部职位${job}`,
    externalHide: (job: string, note: string) => `不显示外部职位${job}${note}`,
    externalStop: (company: string, n: number, note: string) => `停用外部公司「${company}」，下架 ${n} 个职位${note}`,
    externalResume: (company: string, note: string) => `恢复导入外部公司「${company}」${note}`,
    externalTakedown: (company: string, n: number, note: string) =>
      `公司要求删除「${company}」，下架 ${n} 个职位${note}`,
    chatRiskClose: (employer: string, why: string, note: string) => `看过并关闭「${employer}」的聊天风险${why}${note}`,
    photoApprove: (employer: string) => `通过「${employer}」的门店照片`,
    photoReject: (employer: string, note: string) => `退回「${employer}」的门店照片${note}`,
  },
};

export const adminMessages: Dictionary<typeof adminZh> = { key: "admin", zh: adminZh };
