// Round 20 (ADR 0023): the job list and the job page — JobList, JobCard, job-card-parts, FilterForm, ActiveFilters,
// filter-query (the chips), JobDetail, DescriptionTabs, job-facts, seeker/format (pay, hours, posted), SaveJobButton,
// saved-client, ShareJob, ReportJob, report.ts, StartEmployerChat, ContactReveal, BackLink, app/jobs
// (titles, the list's heading, not-found, actions). The share text (shareSummary, withLink) stays Chinese, like B's
// share-texts: it goes to WeChat groups. The application's status words are in seeker-me (applications.ts).
// Amounts arrive formatted (formatAmount / formatMoney); places, job titles and employers' names as written.

import type { Dictionary } from "@/i18n/messages";

const seekerJobsZh = {
  // app/jobs/page.tsx, JobList.tsx, BackLink.tsx
  list: {
    title: "奥克兰中文工作",
    // The list's h1, beside the two section links: one line on a 375 px phone, so three whole cards still fit.
    heading: "奥克兰中文工作",
    sections: "外部职位分区",
    internships: "实习",
    professional: "专业职位",
    listLabel: "职位列表",
    found: (n: number) => `找到 ${n} 个职位`,
    all: (n: number) => `共 ${n} 个职位，最新发布在前`,
    recommendedCount: (n: number) => `共 ${n} 个职位，按求职期望排序`,
    recommendedFound: (n: number) => `找到 ${n} 个职位，按求职期望排序`,
    clear: "清除筛选，看全部职位",
    loading: "正在加载职位",
    emptyTitle: "暂时没有符合条件的职位",
    emptyHint: "换个条件试试，或者过几天再来看看。",
    back: "职位列表",
    // #376: the preview column beside the list, from 1280 px.
    preview: "职位预览",
    openFull: "查看完整页面",
  },
  order: {
    label: "职位排序",
    /** After the count when the list is really ordered by preferences: opens how (review F1 复核 g5). */
    why: "怎么排的？",
    recommendedLabel: "推荐",
    latestLabel: "最新",
    signed_out: "登录后可按你填写的求职期望推荐。当前按最新展示。",
    employer: "推荐工作供求职者使用。当前按最新展示，可在账号页切换身份。",
    no_preferences: "还没有保存期望岗位、地区或最低时薪。当前按最新展示，保存其中一项即可使用推荐。",
    recommended:
      "按你已保存的岗位、地区和最低时薪排序，符合项多的优先，同样符合时最新在前。薪资范围包含你的期望时计为符合，不代表保证起薪。",
    all_same: "当前结果都同样符合你的求职期望，按最新顺序展示。",
    no_matches: "当前结果没有符合你已填写期望的职位，保留最新顺序。你也可以调整筛选或求职期望。",
    private: "推荐只供你自己查看，无需公开简历，也不会因此把求职期望公开给雇主。",
    signIn: "登录并返回",
    switchIdentity: "前往账号页",
    edit: "完善求职期望",
  },
  // seeker/format.ts and job-facts.ts: the figures come formatted.
  pay: {
    /** After the amount, written straight on: $25–27/小时. */
    hourUnit: "/小时",
    perHour: (amount: string) => `${amount}/小时`,
    range: (low: string, high: string) => `${low}–${high}`,
    from: (amount: string) => `${amount} 起`,
    minPayChip: (amount: string) => `时薪 ${amount} 起`,
  },
  hours: {
    perWeek: (range: string) => `每周 ${range} 小时`,
    // On a job card, where it shares one line with the area and how to reach the employer (#242).
    perWeekShort: (range: string) => `${range} 小时/周`,
  },
  posted: {
    today: "今天",
    daysAgo: (n: number) => `${n} 天前`,
    on: (date: string, ago: string) => `${date}发布（${ago}）`,
  },
  closes: {
    inDays: (date: string, days: number) => `${date}截止（还有 ${days} 天）`,
    closed: (date: string) => `${date}已截止`,
    closedNote: "这个职位已截止，可能已经招满。",
  },
  // jobTags(): the card's and the page's tags, by key (seeker/format.ts jobTagKeys); their colours come from the key
  // (tag-kind.ts JOB_TAG_KINDS), not the words.
  tags: {
    label: "标签",
    urgent: "急招",
    meals: "包餐",
    housing: "包住",
    student: "接受学签",
  },
  card: {
    region: "地区",
    hours: "工时",
    contact: "联系",
    contactPublic: "联系方式公开",
    contactByChat: "聊天交换联系方式",
  },
  // EmployerActivityLine.tsx (#381, ADR 0038): on job cards and the job page; only what is good, nothing slow.
  activity: {
    label: "老板活跃度",
    onlineToday: "今天在线",
    replies: { hour: "通常 1 小时内回复", day: "通常当天内回复" },
    join: " · ",
  },
  // JobDetail.tsx, DescriptionTabs.tsx, the page's title when the job is gone.
  detail: {
    facts: "职位信息",
    region: "地区",
    hoursAndShifts: "工时和班次",
    employmentType: "用工形式",
    food: "食宿",
    meals: "包餐",
    noMeals: "不包餐",
    housing: "包住",
    noHousing: "不包住",
    visas: "接受的签证",
    notStated: "未注明",
    listJoin: "、",
    clauseJoin: "，",
    languages: (list: string) => `工作语言：${list}`,
    visaNote: "。签证一项是雇主提供的信息，不构成签证或移民建议。",
    employer: "雇主",
    employerPage: "查看企业主页 →",
    employerPageShort: "查看企业主页",
    contactEmployer: "联系雇主",
    description: "职位描述",
    descriptionLanguage: "描述语言",
    chinese: "中文",
    english: "English",
    notFoundTitle: "职位不存在",
  },
  // job-facts.ts: minimumWageNote, verificationNote. 导师决定 3: say which minimum wage is checked.
  minimumWage: {
    rate: (country: string, amount: string, from: string) => `${country}成人最低时薪 ${amount}（${from} 起）`,
    below: (rate: string) => `低于${rate}。雇主不得低于最低工资支付，如有疑问可以举报这个职位。`,
    at: (rate: string) => `等于${rate}。`,
    near: (rate: string) => `接近${rate}。`,
  },
  verification: {
    accredited: (number: string) => `已核对企业登记（${number}），雇主为移民局认证雇主。`,
    verified: (number: string) => `已核对企业登记（${number}），确认这家企业真实存在。`,
    unverified: "雇主还没有完成企业验证。请自行核实，不要向雇主支付任何费用。",
  },
  // FilterForm.tsx, ActiveFilters.tsx, filter-query.ts
  filter: {
    search: "搜索职位",
    searchPlaceholder: "搜索职位，如 服务员、厨师",
    open: "筛选",
    openWithCount: (n: number) => `筛选 · ${n}`,
    title: "筛选",
    region: "地区",
    industry: "行业",
    role: "岗位类别",
    type: "工作类型",
    food: "食宿",
    meals: "包餐",
    housing: "包住",
    minPay: "最低时薪",
    visa: "雇主接受的签证",
    any: "不限",
    clear: "清空条件",
    finding: "正在查找…",
    show: "查看职位",
    visaChip: (visa: string) => `签证：${visa}`,
    queryChip: (query: string) => `“${query}”`,
    chosen: (n: number) => `已选 ${n}`,
    remove: (label: string) => `去掉条件：${label}`,
    clearAll: "全部清除",
  },
  // SaveJobButton.tsx, saved-client.ts
  save: {
    save: "收藏",
    saved: "已收藏",
    label: (title: string) => `收藏：${title}`,
    savedToast: "已收藏，可以在「收藏和进度」里查看",
    unsavedToast: "已取消收藏",
    saveFailed: "网络有问题，没有收藏上，请重试",
    unsaveFailed: "网络有问题，没有取消，请重试",
  },
  // ShareJob.tsx
  share: {
    label: "分享",
    title: "分享给朋友",
    inWeChat: "点右上角「···」，可以发送给朋友或分享到朋友圈。",
    more: "分享…",
    copyLink: "复制链接",
    copyText: "复制这段文字",
  },
  // ReportJob.tsx, report.ts, app/jobs/[id]/actions.ts
  report: {
    prompt: "职位信息有问题？",
    open: "举报这个职位",
    legend: "举报这个职位",
    hint: "请选择最符合的原因。举报不会告诉雇主是谁发的。",
    note: "补充说明（选填）",
    notePlaceholder: "例如：电话里要求先交 200 元押金",
    cancel: "取消",
    submit: "提交举报",
    networkError: "网络有问题，举报没有发出，请稍后再试",
    thanks: "谢谢你的举报",
    thanksDetail: "我们会尽快核查这个职位。在此之前，如果雇主要求你付钱或交出证件，请不要照做。",
    // 「发出的举报可以在「我的」里看到。」 with 我的 as a link.
    seeBefore: "发出的举报可以在",
    seeLink: "「我的」",
    seeAfter: "里看到。",
    already: "你已经举报过这个职位，我们会尽快核查。",
    limited: "今天的举报次数已经到上限，明天再试。",
    limitedSignedOut: "今天的举报次数已经到上限，明天再试。登录后可以继续举报。",
    noReason: "请选择举报原因",
    noteTooLong: (max: number) => `补充说明最多 ${max} 字`,
    otherNeedsNote: "选择“其他”时，请简单写一下原因",
    jobGone: "找不到这个职位，可能已经下架",
    // ADR 0027: chat messages attached to the report (ReportEvidence.tsx).
    evidence: {
      legend: "附上聊天记录（选填）",
      hint: (max: number, days: number) =>
        `从你和这家雇主的聊天里选，最多 ${max} 条。只有审核员能看到，举报处理完 ${days} 天后删除。`,
      loading: "正在读取聊天记录…",
      notLoaded: "聊天记录没取到",
      me: "我",
      employer: "雇主",
      about: "职位：",
      count: (n: number, max: number) => `已选 ${n} / ${max} 条`,
      signedOut: "登录已经失效，请重新登录后再附上聊天记录",
      notYours: "选中的聊天记录有变化，请重新选择",
      imagesLegend: "附上截图（选填）",
      imagesHint: (max: number, mb: number) =>
        `最多 ${max} 张，JPG、PNG 或 WebP，每张不超过 ${mb} MB。上传时会去掉图片里的拍摄地点等信息，只有审核员能看到。`,
      chooseImages: "选择截图",
      removeImage: (name: string) => `移除 ${name}`,
      tooManyImages: (max: number) => `截图最多 ${max} 张`,
      imageTooBig: (mb: number) => `每张截图不能超过 ${mb} MB`,
      notImage: "只能上传 JPG、PNG 或 WebP 格式的图片",
      /** A JPEG that ends before its end-of-image marker (image-metadata.ts isCutJpeg). */
      cutImage: "这张图片不完整，请重新截图或换一张。",
    },
  },
  // StartEmployerChat.tsx
  chat: {
    start: "立即沟通",
    closed: "招聘已结束",
    manageOwn: "管理本企业职位",
    switchToSeeker: "切换为求职者",
    stopped: "该职位已停止招聘，请查看雇主的其他职位。",
  },
  // ContactReveal.tsx, the contact block on app/jobs/[id]/page.tsx; contactKinds() in job-facts.ts.
  contact: {
    title: "联系方式",
    show: "查看联系方式",
    signInFor: (kinds: string) => `登录后可以查看雇主的${kinds}。`,
    signInForAny: "登录后可以查看雇主的联系方式。",
    signIn: "登录查看联系方式",
    loading: "正在获取联系方式…",
    failed: "暂时无法获取联系方式，请稍后再试。",
    noAnswer: "网络有问题，联系方式没取到。",
    phone: "电话",
    wechat: "微信",
    email: "邮箱",
    /** The rows' labels. */
    rows: { phone: "电话", wechat: "微信", email: "邮箱" },
    warning: "联系雇主时，不要预先支付押金、介绍费或任何费用，也不要交出护照原件。遇到这种情况请举报这个职位。",
    signedInAs: (email: string) => `已登录：${email}`,
    mine: "我的",
    notPublic:
      "雇主没有公开联系方式。点「立即沟通」，在聊天里申请交换：你发起时先给出自己的联系方式，雇主同意后才会给你。",
  },
  // app/jobs/[id]/not-found.tsx
  notFound: {
    title: "这个职位不存在或已下架",
    others: "看看其他职位",
    body: "链接可能有误，或者雇主已经关闭了这个职位。",
  },
};

export const seekerJobsMessages: Dictionary<typeof seekerJobsZh> = { key: "seekerJobs", zh: seekerJobsZh };
