// Round 20 (ADR 0023): messaging. Covers components/seeker/MessageWorkspace.tsx, ChatThread.tsx, MessageLog.tsx,
// RetryBoundary.tsx, ChatInteractions.tsx, ChatExchanges.tsx, ExchangeAction.tsx, ChatReportButton.tsx,
// ConversationJob.tsx, ChatActivity.tsx and chat-warnings.ts, the chat libraries lib/chat-consent.ts,
// lib/chat-report.ts and lib/chat-activity.ts, and app/messages/** (page title, loading, error.tsx,
// server-notifications.ts). ChatDialog, ChatReplay, ContactReveal, StartEmployerChat and InterviewAnswer are
// line A's; chat-demo.ts is demo conversation content and is not translated.
import type { Dictionary } from "@/i18n/messages";

const chatZh = {
  /** app/messages/page.tsx and loading.tsx */
  page: {
    title: "聊天",
    suspense: "加载聊天…",
    loading: "正在加载聊天",
  },

  /** app/messages/error.tsx */
  errorPage: {
    title: "聊天页面出了点问题",
    body: "已经点了发送、还没送到的消息留在这台设备上，聊天页面下次打开时会自动发出。",
    retry: "重试",
    backToWorkspace: "回工作台",
  },

  /** RetryBoundary.tsx (its own button; the title and note come from whoever uses it). */
  retryBoundary: {
    retry: "重试",
  },

  /** MessageWorkspace.tsx */
  workspace: {
    headingEmployer: "招聘聊天",
    headingSeeker: "求职聊天",
    unreadCount: (n: number) => `${n} 条未读消息`,
    allRead: "消息已全部读完",
    demoData: "演示数据",
    threadFailedTitle: "这段聊天没显示出来",
    threadFailedNote: "没发出去的话还在输入框里，点重试再打开。",
    demoFooter: "演示账号：这里的联系人和他们的回复都是演示内容。",
    footer: "消息保存在服务器上，双方都能看到；对方的新消息在这个页面上 10 秒内出现。",
    listLabel: "聊天列表",
    recent: "最近联系",
    conversationCount: (n: number) => `${n} 个会话`,
    /** Read with emptyEmployer or emptySeeker after it on the same line (the English ends with a space). */
    empty: "还没有聊天。",
    emptyEmployer: "求职者在你的职位上找你聊，或者你在推荐人才里点「发起聊天」，就会出现在这里。",
    emptySeeker: "在职位详情里点「立即沟通」，就会出现在这里。",
    previewEmpty: "尚未发送消息",
    pickerLabel: "选择会话",
    pickerTitle: "选择一位联系人",
    pickerUnread: (n: number) => `你有 ${n} 条未读消息`,
    pickerNoUnread: "暂无未读消息",
  },

  /** ChatThread.tsx */
  thread: {
    label: (person: string) => `与${person}的聊天`,
    seekerProfile: "求职者主页",
    employerProfile: "企业主页",
    viewJob: "查看职位",
    report: "举报",
    back: "返回会话列表",
    more: (person: string) => `更多：${person}`,
    viewProfile: (person: string) => `查看${person}的主页`,
    /** Before the job's title, which is the employer's own words (marked separately). */
    appliedFor: "应聘：",
    hiringFor: "招聘：",
    composerLabel: "输入消息",
    composerPlaceholder: "输入消息…",
    send: "发送",
  },

  /** ConversationJob.tsx: the job strip above the messages. */
  conversationJob: {
    label: "职位",
    link: (title: string) => `聊的职位：${title}，查看职位详情`,
    linkWithPay: (title: string, pay: string) => `聊的职位：${title}，${pay}，查看职位详情`,
    closed: "已停止招聘",
  },

  /** MessageLog.tsx */
  // ChatThread / MessageLog (#253): what the outbox still holds, said where the person is looking.
  delivery: {
    waiting: (count: number) => `${count} 项还没送到服务器，连上网后会自动再发。`,
    unreached: "连不上服务器，消息可能不是最新的。",
    retry: "重试",
    unsent: "未送出",
    openFailed: "网络有问题，没能发起聊天，请稍后再试。",
  },
  // messages/actions.ts: the sizes of a conversation (SHARED_MESSAGES_MAX in src/db/conversations.ts) and of the own
  // record (src/lib/chat-server/own-limits.ts).
  limits: {
    messagesFull: (max: number) => `这段对话里已经有 ${max} 条消息，到上限了，这条没有发出。`,
    conversationsFull: (max: number) => `你已经有 ${max} 段这样的对话，到上限了，没能发起新的聊天。`,
    importTooBig: "这台设备上的旧聊天记录太多，没有存到服务器。",
    reportsFull: (max: number) => `你已经保存了 ${max} 条聊天举报，到上限了，这次举报没有保存。`,
  },
  log: {
    label: "消息记录",
    empty: "尚未发送消息",
    /** The read state as the sender hears it: 「对方已读」. */
    counterpartRead: (state: string) => `对方${state}`,
    warningsLabel: "合规提醒",
    reportMessage: "举报这条消息",
  },

  /** ChatActivity.tsx and lib/chat-activity.ts */
  /** src/lib/chat-server/shared-view.ts and messages/actions.ts: times the server writes into the chat list. */
  times: {
    yesterday: "昨天",
    justNow: "刚刚",
    /** The title of an exchange the reader may not see (withdrawn, turned down). */
    withheld: "资料",
    /** The default name of a job seeker without a page (db/conversations.ts stores it). */
    seekerName: "求职者",
    /** Times stored as Chinese words (demo chats, older records), shown by shownTime() in chat-store.ts. */
    weekdays: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
    minutesAgo: (n: number) => `${n} 分钟前`,
    hoursAgo: (n: number) => `${n} 小时前`,
  },

  activity: {
    chatLabel: "沟通状态",
    employerSummaryLabel: "雇主沟通情况",
    employerJobLabel: "雇主招聘沟通情况",
    counterpart: (state: string) => `对方${state}`,
    lastSeen: (state: string) => `最近在线：${state}`,
    loadingLastActive: "最近上线时间加载中",
    repliedByMe: (n: number) => `你今日已回复 ${n} 位求职者`,
    repliedByEmployer: (n: number) => `雇主今日已回复 ${n} 位求职者`,
    repliedToday: (n: number) => `今日已回复 ${n} 位求职者`,
    noEmployerReplies: "雇主今日回复人数暂无记录",
    noRepliesToday: "今日回复人数暂无记录",
    demo: "演示状态",
    /** messageReadLabel */
    read: "已读",
    readByMe: "我已读",
    unread: "未读",
    readUnknown: "阅读状态未知",
    unreadByMe: "我未读",
    /** lastActiveLabel */
    lastActiveUnknown: "最近上线时间未知",
    onlineJustNow: "刚刚在线",
    onlineMinutes: (n: number) => `约 ${n} 分钟前在线`,
    onlineHours: (n: number) => `约 ${n} 小时前在线`,
    onlineDays: (n: number) => `约 ${n} 天前在线`,
    onlineOverAWeek: "一周前在线",
  },

  /** lib/chat-consent.ts: what the two sides may swap. */
  exchangeKinds: {
    contact: "联系方式",
    resume: "简历与企业资料",
  },

  /** lib/chat-consent.ts: the field names of what is handed over (the values are the person's own text). */
  payloadFields: {
    phone: "电话",
    wechat: "微信",
    email: "邮箱",
    businessName: "企业",
    personName: "称呼",
    headline: "简介",
    businessBio: "企业介绍",
    personBio: "个人介绍",
    languages: "语言",
    availability: "时间安排",
    skills: "技能",
    experience: "岗位经验",
    experienceYears: (years: number) => `${years} 年`,
    wanted: "求职意向",
  },

  /** ChatExchanges.tsx: the ＋ menu beside the message box. */
  exchangeMenu: {
    buttonLabel: "交换资料或联系方式",
    groupLabel: "沟通工具",
    resume: "交换资料",
    contact: "交换联系方式",
    done: "已交换",
    waiting: "待同意",
  },

  /** ChatExchanges.tsx: one swap request in the message log. */
  exchange: {
    label: (kind: string) => `${kind}交换请求`,
    titleMine: (kind: string) => `你申请交换${kind}`,
    titleTheirs: (kind: string) => `对方申请交换${kind}`,
    demo: "演示请求",
    pendingMine: "你已提供自己的资料，对方现在能看到。等待对方同意后，你会看到对方的资料。",
    pendingTheirs: "对方已先提供自己的资料。你同意后，对方才会看到你的资料；也可以拒绝。",
    rejectedMine: "对方已拒绝，没有给出资料。",
    rejectedTheirs: "你已拒绝，你的资料没有给对方。",
    cancelledMine: "请求已撤回，对方不再看到你的资料。",
    cancelledTheirs: "请求已撤回，对方的资料已收回。",
    accepted: "双方已同意，资料已交换。",
    theirPayload: "对方的资料",
    myPayloadPending: "我提供的资料",
    myPayload: "我的资料",
    withdraw: "撤回请求",
    viewAndAgree: "查看并同意",
    refuse: "拒绝交换",
  },

  /** ExchangeAction.tsx: the dialog that asks for or agrees to a swap. */
  exchangeDialog: {
    agreeTitle: (kind: string) => `同意交换${kind}`,
    askTitle: (kind: string) => `申请交换${kind}`,
    agreeNote: "对方已经先提供了自己的资料。同意后，对方会看到你的这些资料。",
    askNote:
      "主动发起交换的一方先提供自己的资料：请求发出后，对方马上能看到你的这些资料；对方同意后，你才会看到对方的资料。",
    mineLabel: "我的交换内容",
    agreeHeading: "同意后给对方的资料",
    askHeading: "发出请求时给对方的资料",
    /** Read with nothingYetAgree or nothingYetAsk after it on the same line (the English ends with a space). */
    nothingYet: (kind: string) => `你还没有填写${kind}。`,
    nothingYetAgree: "填好后才能同意交换。",
    nothingYetAsk: "先填好自己的，才能发起交换。",
    editMine: "编辑我的资料",
    fillMine: (kind: string) => `去主页填写${kind}`,
    keepNote: "对方可能保存你给出的资料。请求被拒绝时，对方不会给出资料；撤回请求后，对方不再看到你的资料。",
    cancel: "取消",
    agree: "同意并交换双方资料",
    ask: "发送交换请求",
  },

  /** lib/chat-report.ts: why someone reports a chat. */
  reportReasons: {
    harassment: "骚扰、辱骂或威胁",
    fraud: "诈骗或虚假信息",
    fees: "收取押金、介绍费或其他费用",
    privacy: "泄露隐私或冒用身份",
    discrimination: "歧视或不当招聘要求",
    illegal: "其他违法或违规行为",
    other: "其他问题",
  },

  /** ChatReportButton.tsx */
  report: {
    buttonLabel: "举报聊天",
    buttonTitle: "举报聊天对方",
    dialogTitle: "举报聊天对方",
    sentTitle: "举报已记录",
    sentNote: "前端演示：举报及聊天证据已保存到本机，尚未送交平台处理；不会通知对方。",
    close: "关闭",
    toast: "举报已记录",
    /** Around the other person's name, which is their own words (marked separately). */
    targetBefore: "举报对象：",
    targetAfter: (role: string) => ` · ${role}`,
    roleSeeker: "求职者",
    roleEmployer: "雇主",
    reasonLabel: "举报原因",
    reasonPlaceholder: "请选择",
    rangeLabel: "举报范围",
    rangePlaceholder: "整段聊天（最近 100 条）",
    messageOption: (number: number, text: string) => `${number}. ${text}`,
    noteRequired: "补充说明（必填）",
    noteOptional: "补充说明（选填）",
    evidenceNote: "举报会附带所选聊天内容，仅用于处理举报。前端演示记录保存在本机。",
    noReason: "请选择举报原因",
    noNote: "请补充说明具体问题",
    notSaved: "举报未保存，请重试",
    cancel: "取消",
    submit: "提交举报",
    history: (n: number) => `本机举报记录（${n}）`,
    noExtraNote: "未补充说明",
  },

  /** chat-warnings.ts: the reminder under a message that hits a chat rule (the matched words are not translated). */
  warnings: {
    feeForbidden: "找工不允许向求职者收取押金或任何费用",
    feeCaution: "请谨慎，不要先付钱；可以举报。",
    visaSellingForbidden: "找工不允许用办签证、包工签或包身份招人",
    visaSellingCaution: "请谨慎，可以举报。",
    ethnicForbidden: "找工不允许按种族或国籍招人",
    ethnicCaution: "请谨慎，可以举报。",
    incoming: (forbidden: string, caution: string) => `${forbidden}。${caution}`,
    /** Around the words quoted from the message itself, which stay as they were written (marked separately). */
    outgoingBefore: "这条消息提到",
    outgoingAfter: (forbidden: string) => `：${forbidden}，建议修改后再发。`,
    /** Between the rules of one outgoing warning. */
    forbiddenJoiner: "；",
  },

  /** app/messages/server-notifications.ts: the job seeker's job-alert notifications. */
  notifications: {
    type: "提醒",
    alertTitle: (alertName: string) => `有新职位符合提醒「${alertName}」`,
    hiring: (business: string, title: string) => `${business}正在招聘${title}`,
    noLongerHiring: (title: string) => `${title}已经停止招聘`,
    thisJob: "这个职位",
  },

  /**
   * ChatPhrases.tsx: 常用语 above the box and their 管理 (#372); the job seeker's 开场白 (#373); ADR 0035. The
   * defaults and templates are the ones the user approved (10-24); {职位} in an opener becomes the job's name.
   */
  phrases: {
    rowLabel: "常用语",
    sendPhrase: (phrase: string) => `发送常用语：${phrase}`,
    manage: "管理",
    manageLabel: "管理常用语和开场白",
    dialogTitle: "常用语和开场白",
    listHeading: "常用语",
    listNote: (max: number, length: number) =>
      `点一条就发出。最多 ${max} 条，每条最多 ${length} 个字。不能写电话、微信、邮箱：交换联系方式请在聊天里申请交换。`,
    phraseLabel: (n: number) => `常用语 ${n}`,
    moveUp: (n: number) => `上移第 ${n} 条`,
    moveDown: (n: number) => `下移第 ${n} 条`,
    remove: (n: number) => `删除第 ${n} 条`,
    add: "添加一条",
    restore: "恢复默认",
    openerHeading: "开场白",
    openerNote:
      "在职位页点「立即沟通」开始新的对话时，它会填进输入框，不会自动发出：你看过、可以改，再按发送。{职位} 会换成职位的名字。",
    openerTemplate: (n: number) => `模板 ${n}：`,
    openerOwn: "自己写",
    openerOwnLabel: "自己写的开场白",
    save: "保存",
    saving: "正在保存…",
    saved: "已保存",
    notSaved: "没有保存成功，请稍后再试。",
    tooMany: (max: number) => `最多 ${max} 条常用语。`,
    tooLong: (n: number, max: number) => `第 ${n} 条超过 ${max} 个字了。`,
    openerTooLong: (max: number) => `开场白最多 ${max} 个字。`,
    openerEmpty: "自己写的开场白还是空的。",
    contact: (n: number, found: string) => `第 ${n} 条里有联系方式（${found}），请删掉再保存。`,
    openerContact: (found: string) => `开场白里有联系方式（${found}），请删掉再保存。`,
    foundJoiner: "、",
    seekerDefaults: [
      "请问这个职位还在招吗？",
      "请问每周大概排几个班，每个班几个小时？",
      "请问什么时候方便去面试？",
      "简历已经发给您了，麻烦您看一下。",
      "好的，谢谢您，我会准时到。",
    ],
    employerDefaults: [
      "您好，看了您的资料，方便聊一下吗？",
      "请问您每周哪几天、什么时间段可以上班？",
      "请问您做过类似的工作吗？",
      "请问您什么时候方便来面试？",
      "谢谢您的关注，这个职位已经招到人了。",
    ],
    openers: [
      "您好，我对「{职位}」很感兴趣，想多了解一下，方便聊聊吗？",
      "您好，我想应聘「{职位}」，我的资料和简历在主页上，麻烦您看一下，谢谢！",
      "您好，请问「{职位}」还在招人吗？我可以尽快开始上班。",
    ],
  },
};

export const chatMessages: Dictionary<typeof chatZh> = { key: "chat", zh: chatZh };
