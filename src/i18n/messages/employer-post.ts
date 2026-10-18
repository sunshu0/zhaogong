// Round 20 (ADR 0023): the employer's posting flow, in both languages. Covers /employer/post (PostFlow.tsx,
// PostFlowSteps.tsx, PostFlowBars.tsx, post-flow-state.ts, ChatPost.tsx, DraftCard.tsx, draft-checklist.ts,
// app/employer/post/page.tsx and error.tsx), the job form (DraftForm.tsx, DraftFormParts.tsx,
// DraftFormSections.tsx, JobRolesField.tsx, PayReferenceHint.tsx, FindingsPanel.tsx), what comes after posting
// (Published.tsx) and editing, reposting and copying a job (EditJob.tsx, RepublishJob.tsx, KeptJobForm.tsx and
// the jobs/[id], /copy and /republish pages).
//
// Not here: the assistant's own replies (lib/ai-post), the parser's vocabulary, share-texts.ts, the enum labels
// in i18n/labels.ts, and the checklist's 「改一下…」 messages, which are sent
// to the Chinese-only assistant rather than shown as interface text.

import type { Dictionary } from "@/i18n/messages";

const employerPostZh = {
  /** app/employer/post/page.tsx, jobs/[id]/page.tsx, /copy and /republish: the pages' titles. */
  pages: {
    postTitle: "发布招聘",
    postDescription: "粘贴招聘消息，自动整理成中英文职位，发布前检查是否合规。",
    editTitle: "编辑职位",
    copyTitle: "复制为新职位",
    republishTitle: "重新发布职位",
  },

  /** PostFlow.tsx: the kept draft and the step's own error boundary. */
  postFlow: {
    restored: "接着上次没写完的继续（草稿只存在这个标签页里）。",
    startOver: "清空重来",
    stepFailedTitle: "这一步没显示出来",
    stepFailedNote: "你填的内容还在，点重试接着填。",
  },

  /** app/employer/post/error.tsx: the whole posting page failed. */
  postError: {
    title: "发布页面出了点问题",
    retry: "重试",
    backToJobs: "回到职位管理",
    body: "你写的招聘还存在这个标签页里，点重试或者稍后回来都能接着写。",
  },

  /** post-flow-state.ts: PUBLISH_ERRORS, why the server would not publish. */
  publishErrors: {
    signed_out: "登录已失效，请重新登录后再发布。",
    no_identity: "需要先开通雇主身份，请从页头的「发布招聘」重新进入。",
    banned: "这个雇主账号已被停用，不能发布职位。",
    not_ready: "服务器检查没有通过，请回到上一步修改。",
  },

  /** PostFlowSteps.tsx: the step list, the mode switch and each step's body. */
  steps: {
    listLabel: "发布步骤",
    chat: "和助手对话",
    paste: "粘贴",
    form: "核对",
    preview: "预览发布",
    modeLabel: "发布方式",
    modeChat: "对话发布",
    modeForm: "直接填表",
    pasteHeading: "一分钟发布招聘",
    pasteLabel: "把微信群里的招聘消息粘贴进来，或者直接写：招什么人、在哪个区、时薪多少。",
    parsing: "整理中…",
    parse: "整理成职位",
    tryExample: "用示例试试",
    emptyForm: "不用粘贴，直接填表",
    formHeading: "核对职位信息",
    previewHeading: "预览：这是求职者看到的样子。确认无误就可以发布了。",
    previewNeedsReview: "这个职位会先经过人工审核，通过后才公开。",
    previewContactTitle: "联系方式",
    /** `kinds` is the list of contact kinds the job makes public, already joined. */
    previewContactPublic: (kinds: string) => `登录后可以查看雇主的${kinds}。`,
    previewContactPrivate: "雇主没有公开联系方式。求职者可以在聊天中申请交换，双方同意后才交换。",
    previewBanned: "这个雇主账号已被停用，职位已全部下架，不能再发布。",
  },

  /** PostFlowBars.tsx: the sticky bar under the form and under the preview. */
  bars: {
    back: "上一步",
    preview: "预览",
    readyNeedsReview: "可以发布，需人工审核",
    ready: "可以发布",
    backToEdit: "返回修改",
    postingAs: (shopName: string) => `以「${shopName}」发布`,
    /** holdReason() in use-draft-form.ts, also shown by EditJob.tsx and RepublishJob.tsx. */
    holdReason: (problems: number, missing: number) =>
      [problems && `${problems} 个问题要处理`, missing && `${missing} 项没填`].filter(Boolean).join("，"),
    publishing: "发布中…",
    submitForReview: "提交审核",
    publish: "发布",
  },

  /** ChatPost.tsx: posting by talking to the assistant. */
  chat: {
    heading: "和发帖助手一起写招聘",
    scriptAssistant: "开发环境：脚本助手，不是 AI。",
    logLabel: "和发帖助手的对话",
    fromAssistant: "助手：",
    fromYou: "你：",
    thinking: "助手正在整理…",
    quickRepliesLabel: "快捷回复",
    unavailable: "AI 发帖助手暂时不可用。",
    useFormInstead: "改用直接填表",
    sendFailed: "没发出去，请再试一次。",
    inputLabel: "回复助手",
    inputPlaceholder: "输入回复，回车发送（Shift + 回车换行）",
    send: "发送",
    editInForm: "在表单里改",
  },

  /** DraftCard.tsx: the job as the chat has filled it so far. */
  draftCard: {
    cardLabel: "职位卡，随对话更新",
    noTitle: "还没有职位名称",
    rolesPreselected: (names: string) => `岗位类别：${names}（按职位名预选，预览时可以改）`,
    rolesToPick: "岗位类别：待选（预览时选）",
    readyToPreview: "可以预览",
    filledIn: (done: number, total: number) => `已填 ${done} / ${total} 项`,
    problems: (n: number) => ` · ${n} 个问题要处理`,
    collapse: "收起",
    expand: "查看各项",
    needsReview: "这个职位发布后要人工审核。",
    toFill: "待填",
    optional: "可不填",
    change: "改",
    fillIn: "去填",
  },

  /** draft-checklist.ts: each line of the card's list, and what is filled in. */
  checklist: {
    separator: "、",
    titleLabel: "职位名称",
    payLabel: "时薪",
    regionLabel: "地区",
    employmentTypeLabel: "工作类型",
    visaLabel: "签证",
    descriptionLabel: "职位描述",
    contactLabel: "联系方式",
    hoursLabel: "每周工时",
    perksLabel: "包餐包住",
    /** `amount` already carries the currency symbol and the range. */
    payValue: (amount: string) => `${amount}/小时`,
    hoursValue: (range: string) => `${range} 小时`,
    contactPrivate: "不公开 · 聊天交换",
    contactPublic: (kinds: string) => `公开：${kinds}`,
    contactPhone: "电话",
    contactWechat: "微信",
    contactEmail: "邮箱",
    meals: "包餐",
    accommodation: "包住",
    noPerks: "不包吃住",
  },

  /** DraftForm.tsx, DraftFormParts.tsx, DraftFormSections.tsx: the job form. */
  form: {
    notRecognised: "没有识别到，请填写",
    chooseOne: "请选择",
    rangeMin: "最低",
    rangeMax: "最高（可不填）",
    rangeMaxPlaceholder: "可不填",

    jobSection: "职位",
    titleZh: "职位名称（中文）",
    titleZhPlaceholder: "例如：前厅服务员",
    titleEn: "职位名称（英文）",
    titleEnPlaceholder: "e.g. Front-of-house staff",
    industry: "行业",
    urgent: "急招",
    employmentType: "工作类型",

    placeSection: "地点和时间",
    region: "地区",
    address: "地址（可不填）",
    hoursPerWeek: "每周工时（可不填）",
    hoursUnit: "小时",
    shifts: "班次（可不填）",
    shiftsPlaceholder: "例如：周末晚班",

    paySection: "工资和福利",
    pay: "时薪",
    /** The unit beside the pay boxes; `symbol` is the country's currency symbol. */
    payUnit: (symbol: string) => `${symbol}/小时`,
    /** `country` is the country's name, `amount` the hourly minimum with its symbol, `from` the date it starts. */
    payHint: (country: string, amount: string, from: string) =>
      `${country}最低工资 ${amount}/小时（${from} 起）。只有一个数就只填左边。`,
    meals: "包餐",
    accommodation: "包住",

    requirementsSection: "要求",
    visaAccepted: "可接受的签证",
    visaHint: "只写你接受哪些签证。不要写办签证、包签这类内容。",
    languages: "语言要求（可不选）",

    descriptionSection: "职位描述",
    descriptionZh: "中文描述",
    descriptionEn: "英文描述",
    descriptionEnHint: "根据表格自动生成，可以修改。",
    regenerateEn: "按表格重新生成",

    contactSection: "联系方式",
    contactChoiceLegend: "求职者怎么联系你",
    contactPrivateChoice: "不公开，求职者在聊天中申请交换",
    contactPrivateNote: "你同意后，双方才交换联系方式。",
    contactPublicChoice: "公开给登录的求职者",
    contactPublicNote: "登录的求职者在职位页直接看到。",
    contactLegend: "至少填一种",
    contactHint: "只有登录的求职者才能看到。",
    contactPhone: "电话",
    contactPhonePlaceholder: "021 xxx xxxx",
    contactWechat: "微信号",
    contactEmail: "邮箱",
    contactEmailPlaceholder: "name@example.com",
    contactPrivateBefore: "不用在这里填写。交换时给求职者的资料，请在",
    contactPrivateLink: "企业主页",
    contactPrivateAfter: "的「私密交换资料」里填好。",
  },

  /** JobRolesField.tsx: 岗位类别 (#96), at most two. */
  roles: {
    legend: "岗位类别",
    preselected: (names: string) => `按职位名预选了${names}，可以改。`,
    max: (max: number) => `最多选 ${max} 个。推荐人才按岗位类别找人。`,
    fallback: (names: string) => `不选的话按职位名归到${names}。`,
    none: "还没选。不选的话职位显示「岗位类别待选」，推荐人才时这一项不算分。",
  },

  /** PayReferenceHint.tsx: before an industry is chosen there is nothing to compare with. */
  payReference: {
    chooseIndustry: "选好行业后，这里显示同类职位的时薪。",
  },

  /** FindingsPanel.tsx: the checks before posting, and the field each one points at. */
  findings: {
    title: "发布前检查",
    levelSuffix: "：",
    levelBlock: "不能发布",
    levelRewrite: "请改写",
    levelReview: "需审核",
    clean: "发布前检查：没有发现问题",
    summary: (parts: string) => `发布前检查：${parts}`,
    summaryJoin: "，",
    problemCount: (n: number) => `${n} 个问题`,
    missingCount: (n: number) => `${n} 项没填`,
    cleanNote: "没有发现问题，可以预览发布。",
    missingLead: "还没填：",
    missingJoin: "、",
    footer: "检查最低工资和违规用词：收费、卖签证、按种族或国籍招人不能发布；部分行业要人工审核。",
    fields: {
      titleZh: "中文职位名称",
      titleEn: "英文职位名称",
      industry: "行业",
      employmentType: "工作类型",
      regionId: "地区",
      address: "地址",
      pay: "时薪",
      hoursPerWeek: "每周工时",
      shiftsZh: "班次",
      visaAccepted: "可接受的签证",
      languages: "语言要求",
      descriptionZh: "中文描述",
      descriptionEn: "英文描述",
      contact: "联系方式",
    },
  },

  /** Published.tsx: live now, or waiting for review. */
  published: {
    live: "已发布",
    pendingReview: "已提交审核",
    liveNote: "求职者现在就能看到。",
    pendingNote: "审核通过后公开，可以在「职位管理」里看到进度。",
    seeJobPage: "看看职位页面",
    pendingShare: "审核通过后，可以在「职位管理」里复制发到微信群、小红书和 Skykiwi 的文案。",
    postAnother: "再发一条",
    myJobs: "职位管理",
  },

  /** EditJob.tsx: editing one of the business's own jobs. */
  edit: {
    takenDown: "这个职位已被后台下架，不能修改。",
    notFound: "找不到这个职位，或者它不属于你登录的店铺。",
    backToJobs: "回到职位管理",
    heading: "编辑职位",
    saved: "已保存",
    savedNeedsReview: "修改的内容需要重新审核，通过后公开。",
    savedLive: "修改已生效。",
    seeJob: "查看职位",
    cancel: "取消",
    readyNeedsReview: "保存后需要重新审核",
    ready: "可以保存",
    saving: "保存中…",
    save: "保存",
  },

  /** RepublishJob.tsx: 重新发布 (#69) and 复制为新职位 (#190). */
  republish: {
    notFound: "找不到这个职位，或者它不属于你登录的店铺。",
    cannotCopy: "下架的职位和还在审核的职位不能复制。",
    cannotRepublish: "只有截止超过 14 天的职位才需要重新发布。这个职位可以在职位管理里续期。",
    backToJobs: "回到职位管理",
    copyHeading: "复制为新职位",
    republishHeading: "重新发布",
    copyNote: (title: string) =>
      `用「${title}」的内容新建一条职位，改好后发布。新职位从零开始：没有原职位的申请人、续期和浏览数据；发布前照常检查。原来的职位不变。`,
    republishNote: (title: string, closeDate: string) =>
      `用「${title}」（${closeDate}截止）的内容新建一条职位。发布前按现在的规则重新检查，例如最低工资；原来的职位保持已截止。`,
    cancel: "取消",
    readyNeedsReview: "发布后需要审核",
    ready: "可以发布",
    publishing: "发布中…",
    publish: "发布",
  },

  /** KeptJobForm.tsx: the changes this tab kept, and the form's own error boundary. */
  keptForm: {
    restored: "接着上次没保存的改动继续（只存在这个标签页里）。",
    discard: "放弃改动",
    failedTitle: "表单没显示出来",
    failedNote: "你改的内容还在，点重试接着改。",
  },
};

export const employerPostMessages: Dictionary<typeof employerPostZh> = {
  zh: employerPostZh,
  en: {
    pages: {
      postTitle: "Post a job",
      postDescription:
        "Paste your job message, have it turned into a Chinese and English job, and checked against the rules before you post.",
      editTitle: "Edit job",
      copyTitle: "Copy as a new job",
      republishTitle: "Repost a job",
    },

    postFlow: {
      restored: "Picking up where you left off (the draft is only kept in this tab).",
      startOver: "Clear and start over",
      stepFailedTitle: "This step didn't load",
      stepFailedNote: "What you filled in is still here. Tap Try again to carry on.",
    },

    postError: {
      title: "Something went wrong on the posting page",
      retry: "Try again",
      backToJobs: "Back to my jobs",
      body: "What you wrote is still kept in this tab. Tap Try again, or come back later and carry on.",
    },

    publishErrors: {
      signed_out: "Your sign-in has expired. Sign in again, then post.",
      no_identity: "You need to set up hiring first. Start again from “Post a job” at the top of the page.",
      banned: "This employer account has been stopped and can't post jobs.",
      not_ready: "The server checks didn't pass. Go back a step and fix it.",
    },

    steps: {
      listLabel: "Posting steps",
      chat: "Chat with the assistant",
      paste: "Paste",
      form: "Check",
      preview: "Preview and post",
      modeLabel: "How to post",
      modeChat: "Post by chat",
      modeForm: "Fill in the form",
      pasteHeading: "Post a job in a minute",
      pasteLabel:
        "Paste the job message from your WeChat group, or just write it: who you need, which area, and the pay per hour.",
      parsing: "Sorting it out…",
      parse: "Turn into a job",
      tryExample: "Try an example",
      emptyForm: "Skip pasting and fill in the form",
      formHeading: "Check the job details",
      previewHeading: "Preview: this is what job seekers see. If it all looks right, you can post it.",
      previewNeedsReview: "This job goes to a person for review first, and shows publicly once it's approved.",
      previewContactTitle: "Contact details",
      previewContactPublic: (kinds) => `Once signed in, job seekers can see the employer's ${kinds}.`,
      previewContactPrivate:
        "The employer's contact details are not public. A job seeker can ask to swap details in chat, and they are only swapped once both agree.",
      previewBanned: "This employer account has been stopped. All its jobs are taken down and it can't post any more.",
    },

    bars: {
      back: "Back",
      preview: "Preview",
      readyNeedsReview: "Ready to post, needs review by a person",
      ready: "Ready to post",
      backToEdit: "Back to edit",
      postingAs: (shopName) => `Posting as ${shopName}`,
      holdReason: (problems, missing) =>
        [
          problems && (problems === 1 ? "1 problem to fix" : `${problems} problems to fix`),
          missing && (missing === 1 ? "1 field to fill in" : `${missing} fields to fill in`),
        ]
          .filter(Boolean)
          .join(", "),
      publishing: "Posting…",
      submitForReview: "Submit for review",
      publish: "Post",
    },

    chat: {
      heading: "Write your job with the posting assistant",
      scriptAssistant: "Development: a script assistant, not AI.",
      logLabel: "Chat with the posting assistant",
      fromAssistant: "Assistant:",
      fromYou: "You:",
      thinking: "The assistant is working on it…",
      quickRepliesLabel: "Quick replies",
      unavailable: "The AI posting assistant isn't available right now.",
      useFormInstead: "Fill in the form instead",
      sendFailed: "That didn't send. Try again.",
      inputLabel: "Reply to the assistant",
      inputPlaceholder: "Type your reply. Enter sends, Shift + Enter starts a new line",
      send: "Send",
      editInForm: "Edit in the form",
    },

    draftCard: {
      cardLabel: "Job card, updates as you chat",
      noTitle: "No job title yet",
      rolesPreselected: (names) => `Roles: ${names} (preselected from the job title, you can change them at preview)`,
      rolesToPick: "Roles: not chosen yet (choose at preview)",
      readyToPreview: "Ready to preview",
      filledIn: (done, total) => `${done} of ${total} filled in`,
      problems: (n) => (n === 1 ? " · 1 thing to fix" : ` · ${n} things to fix`),
      collapse: "Hide",
      expand: "See the list",
      needsReview: "Once posted, this job goes to a person for review.",
      toFill: "To fill in",
      optional: "Optional",
      change: "Change",
      fillIn: "Fill in",
    },

    checklist: {
      separator: ", ",
      titleLabel: "Job title",
      payLabel: "Pay",
      regionLabel: "Area",
      employmentTypeLabel: "Job type",
      visaLabel: "Visas",
      descriptionLabel: "Job description",
      contactLabel: "Contact details",
      hoursLabel: "Hours a week",
      perksLabel: "Meals and accommodation",
      payValue: (amount) => `${amount} an hour`,
      hoursValue: (range) => `${range} hours`,
      contactPrivate: "Private · swapped in chat",
      contactPublic: (kinds) => `Public: ${kinds}`,
      contactPhone: "Phone",
      contactWechat: "WeChat",
      contactEmail: "Email",
      meals: "Meals provided",
      accommodation: "Accommodation provided",
      noPerks: "No meals or accommodation",
    },

    form: {
      notRecognised: "Not picked up — please fill this in",
      chooseOne: "Choose one",
      rangeMin: "Lowest",
      rangeMax: "Highest (optional)",
      rangeMaxPlaceholder: "Optional",

      jobSection: "Job",
      titleZh: "Job title (Chinese)",
      titleZhPlaceholder: "e.g. 前厅服务员",
      titleEn: "Job title (English)",
      titleEnPlaceholder: "e.g. Front-of-house staff",
      industry: "Industry",
      urgent: "Urgent",
      employmentType: "Job type",

      placeSection: "Place and hours",
      region: "Area",
      address: "Address (optional)",
      hoursPerWeek: "Hours a week (optional)",
      hoursUnit: "hours",
      shifts: "Shifts (optional)",
      shiftsPlaceholder: "e.g. Weekend evenings",

      paySection: "Pay and extras",
      pay: "Pay per hour",
      payUnit: (symbol) => `${symbol} an hour`,
      payHint: (country, amount, from) =>
        `Adult minimum wage in ${country}: ${amount} an hour (from ${from}). If there is only one figure, fill in the left box only.`,
      meals: "Meals provided",
      accommodation: "Accommodation provided",

      requirementsSection: "Requirements",
      visaAccepted: "Visas accepted",
      visaHint: "Only say which visas you accept. Don't write about arranging or selling visas.",
      languages: "Language requirements (optional)",

      descriptionSection: "Job description",
      descriptionZh: "Description (Chinese)",
      descriptionEn: "Description (English)",
      descriptionEnHint: "Written from the form, and you can change it.",
      regenerateEn: "Write it again from the form",

      contactSection: "Contact details",
      contactChoiceLegend: "How job seekers contact you",
      contactPrivateChoice: "Private — job seekers ask to swap in chat",
      contactPrivateNote: "Details are only swapped once you agree.",
      contactPublicChoice: "Public to signed-in job seekers",
      contactPublicNote: "Signed-in job seekers see them on the job page.",
      contactLegend: "Fill in at least one",
      contactHint: "Only signed-in job seekers can see them.",
      contactPhone: "Phone",
      contactPhonePlaceholder: "021 xxx xxxx",
      contactWechat: "WeChat ID",
      contactEmail: "Email",
      contactEmailPlaceholder: "name@example.com",
      contactPrivateBefore:
        "Nothing to fill in here. Put the details you swap with job seekers under “Private details for swaps” on your ",
      contactPrivateLink: "Business page",
      contactPrivateAfter: ".",
    },

    roles: {
      legend: "Roles",
      preselected: (names) => `Preselected from the job title: ${names}. You can change this.`,
      max: (max) => `Choose up to ${max}. Suggested candidates are matched by role.`,
      fallback: (names) => `If you choose none, the job title puts it under ${names}.`,
      none: "None chosen yet. The job will show “Roles not chosen yet”, and roles won't count towards suggested candidates.",
    },

    payReference: {
      chooseIndustry: "Once you choose an industry, pay for similar jobs shows here.",
    },

    findings: {
      title: "Checks before posting",
      levelSuffix: ": ",
      levelBlock: "Can't post",
      levelRewrite: "Please rewrite",
      levelReview: "Needs review",
      clean: "Checks before posting: nothing found",
      summary: (parts) => `Checks before posting: ${parts}`,
      summaryJoin: ", ",
      problemCount: (n) => (n === 1 ? "1 problem" : `${n} problems`),
      missingCount: (n) => (n === 1 ? "1 not filled in" : `${n} not filled in`),
      cleanNote: "Nothing found. You can preview and post.",
      missingLead: "Not filled in yet: ",
      missingJoin: ", ",
      footer:
        "We check the adult minimum wage and wording that breaks the rules: charging a fee for the job, selling or arranging visas, and hiring by race or nationality can't be posted. Some industries go to a person for review.",
      fields: {
        titleZh: "Job title (Chinese)",
        titleEn: "Job title (English)",
        industry: "Industry",
        employmentType: "Job type",
        regionId: "Area",
        address: "Address",
        pay: "Pay per hour",
        hoursPerWeek: "Hours a week",
        shiftsZh: "Shifts",
        visaAccepted: "Visas accepted",
        languages: "Language requirements",
        descriptionZh: "Description (Chinese)",
        descriptionEn: "Description (English)",
        contact: "Contact details",
      },
    },

    published: {
      live: "Posted",
      pendingReview: "Submitted for review",
      liveNote: "Job seekers can see it now.",
      pendingNote: "It shows publicly once it's approved. You can follow it under “My jobs”.",
      seeJobPage: "See the job page",
      pendingShare:
        "Once it's approved, you can copy the posts for WeChat groups, Xiaohongshu and Skykiwi under “My jobs”.",
      postAnother: "Post another",
      myJobs: "My jobs",
    },

    edit: {
      takenDown: "This job was taken down by the moderators and can't be changed.",
      notFound: "We can't find this job, or it doesn't belong to the business you're signed in as.",
      backToJobs: "Back to my jobs",
      heading: "Edit job",
      saved: "Saved",
      savedNeedsReview: "Your changes go to a person for review, and show publicly once approved.",
      savedLive: "Your changes are live.",
      seeJob: "See the job",
      cancel: "Cancel",
      readyNeedsReview: "Saving sends it for review again",
      ready: "Ready to save",
      saving: "Saving…",
      save: "Save",
    },

    republish: {
      notFound: "We can't find this job, or it doesn't belong to the business you're signed in as.",
      cannotCopy: "Jobs that are taken down or still under review can't be copied.",
      cannotRepublish:
        "Only a job that closed more than 14 days ago needs reposting. You can renew this one under My jobs.",
      backToJobs: "Back to my jobs",
      copyHeading: "Copy as a new job",
      republishHeading: "Repost",
      copyNote: (title) =>
        `Makes a new job from “${title}”. Change what you need, then post. The new job starts fresh: none of the old job's applicants, renewals or view numbers, and the usual checks before posting. The old job stays as it is.`,
      republishNote: (title, closeDate) =>
        `Makes a new job from “${title}” (closed ${closeDate}). It is checked again against today's rules, such as the adult minimum wage, before posting. The old job stays closed.`,
      cancel: "Cancel",
      readyNeedsReview: "Posting sends it for review",
      ready: "Ready to post",
      publishing: "Posting…",
      publish: "Post",
    },

    keptForm: {
      restored: "Picking up the changes you didn't save (they are only kept in this tab).",
      discard: "Discard changes",
      failedTitle: "The form didn't load",
      failedNote: "Your changes are still here. Tap Try again to carry on.",
    },
  },
};
