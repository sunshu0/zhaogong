// Round 20 (ADR 0023): the employer's own jobs — 职位管理 and everything on a job's card. Covers
// components/employer/{ManageJobs,ManagedJob,ManagedJobActions,HiresQuestion,RenewQuestion,JobStats,
// DuplicateJobNote,ShareTexts}.tsx and {job-card,job-status,job-poster,job-search,job-reminders,hires}.ts,
// plus the page titles of app/employer/jobs/**. The share texts themselves (share-texts.ts) stay Chinese.

import type { Dictionary } from "@/i18n/messages";

const employerJobsZh = {
  /** Page titles of app/employer/jobs and jobs/[id]/stats. The edit, copy and republish titles are in
   * employer-post, the applicants title in employer-applicants. */
  pageTitles: {
    manage: "职位管理",
    stats: "职位数据",
  },

  /** ManageJobs.tsx — the list, its tabs, its search and its notices. */
  manage: {
    heading: "职位管理",
    postNew: "发布新职位",
    searchLabel: "搜索职位名称",
    searchPlaceholder: "搜索职位名称",
    tabsLabel: "按状态",
    tabs: {
      all: "全部",
      active: "招聘中",
      ending: "将截止",
      pendingReview: "审核中",
      timedOut: "已截止",
      closed: "已结束",
      removed: "已下架",
    },
    banned: "这个雇主账号已被停用，职位已全部下架，不能再发布。",
    loading: "正在加载职位",
    /** What a change said when it worked: between the job's own title and the result, each in its own element. */
    noticeSeparator: "：",
    noneYet: "还没有发布过职位。",
    noneInTab: "这个状态下没有职位。",
    noMatch: (query: string) => `没有名称里有「${query}」的职位。`,
    noMatchInTab: (query: string) => `这个状态下没有名称里有「${query}」的职位。`,
  },

  /** ManagedJob.tsx — one job's card: its lines, its status note and what a finished change says. */
  job: {
    editContact: "编辑联系方式",
    last14Days: "近 14 天",
    renewedTimes: (n: number) => `已续期 ${n} 次`,
    rolesTodo: "岗位类别待选，推荐人才时这一项不算分。",
    rolesPick: "去选",
    takenDown: "这个职位已被后台下架。如有疑问请联系我们。",
    pendingReview: "审核通过后才会公开。",
    endingNote: (closeDate: string) => `${closeDate}截止。还要招人就续期，在列表里的位置不变。`,
    timedOutNote: (closeDate: string, days: number) => `${closeDate}已截止，求职者看不到了。${days} 天内还可以续期。`,
    renew: "续期",
    /** 截止超过 14 天: the sentence around the 重新发布 link. */
    republishNoteStart: "截止超过 14 天，不能再续期。还要招人的话，用原内容",
    republishNoteLink: "重新发布",
    republishNoteEnd: "一条新职位，会按现在的规则重新检查。",
    closeSubmit: "确定结束招聘",
    hiresSubmit: "保存",
    renewDone: (days: number, closeDate: string) => `已续期 ${days} 天，${closeDate}截止`,
    closeDone: "已结束招聘",
    closeDoneWithHires: (hires: string) => `已结束招聘，${hires}`,
    hiresDone: (hires: string) => `已记录，${hires}`,
  },

  /** ManagedJobActions.tsx and job-card.ts — the main button and the 更多 menu. */
  actions: {
    moreMenuLabel: (title: string) => `更多操作：${title}`,
    refreshDone: "已刷新，排到前面",
    view: "查看",
    edit: "编辑",
    renew: "续期",
    republish: "重新发布",
    refresh: "刷新",
    share: "复制文案",
    hideShare: "收起文案",
    copy: "复制为新职位",
    close: "结束招聘",
    recordHires: "记录招到几人",
    correctHires: "更正招到人数",
  },

  /** job-card.ts — the same numbers on every card. */
  numbers: {
    views: (n: number) => `${n} 次浏览`,
    chats: (n: number) => `${n} 人聊过`,
    noChats: "还没有人聊过",
    contactViews: (n: number) => `${n} 次查看联系方式`,
    contactPrivate: "不公开 · 聊天交换",
    noApplicants: "申请人 0",
    applicants: (n: number) => `${n} 个申请`,
    applicantsWithNew: (total: number, unseen: number) => `${total} 个申请 · ${unseen} 个新`,
  },

  /** job-status.ts — the status tag, the closing date, and why a job cannot be refreshed or renewed. */
  status: {
    /** STATUS_LABELS and PHASE_LABELS; 已结束 (closed) is the same word as expired. */
    tag: {
      active: "招聘中",
      pendingReview: "审核中",
      expired: "已结束",
      removed: "已下架",
      ending: "将截止",
      timedOut: "已截止",
    },
    expiry: {
      pendingReview: (days: number) => `审核通过后开始计算 ${days} 天`,
      closesToday: "今天截止",
      closesInDays: (days: number) => `${days} 天后截止`,
      renewableFor: (days: number) => `还可以续期 ${days} 天`,
      noLongerRenewable: "已不能续期",
    },
    refresh: {
      removed: "已被下架",
      pendingReview: "审核通过后才能刷新",
      expired: "已截止，不能刷新",
      today: "今天已刷新过",
    },
    renew: {
      removed: "已被下架",
      pendingReview: "审核通过后才能续期",
      tooLate: (days: number) => `截止超过 ${days} 天，不能续期`,
      farEnough: (days: number) => `截止日最远到 ${days} 天后，现在不用续期`,
    },
  },

  /** HiresQuestion.tsx and hires.ts — 通过找工招到人了吗？ The product name is not translated. */
  hires: {
    question: (product: string) => `通过${product}招到人了吗？`,
    optional: "（可不填）",
    hired: "招到了",
    none: "没有 / 不确定",
    countLabel: "招到的人数",
    countOption: (n: number) => `${n} 人`,
    why: (product: string) => `只用来统计${product}一共帮多少人找到了工作。`,
    cancel: "取消",
    chooseAnswer: "请选择招到了，或者没有 / 不确定。",
    countRange: (max: number) => `人数请填 1 到 ${max}。`,
    hiredCount: (n: number) => `已招到 ${n} 人`,
    noneHired: (product: string) => `没有通过${product}招到人`,
  },

  /** RenewQuestion.tsx — 续期多久？ */
  renew: {
    question: "续期多久？",
    days: (days: number) => `${days} 天`,
    closesOn: (closeDate: string) => `· ${closeDate}截止`,
    note: (latestDays: number) =>
      `截止日往后推，职位在列表里的位置不变；最远到 ${latestDays} 天后。续期前会按现在的规则再检查一次。`,
    submit: "确定续期",
    cancel: "取消",
  },

  /** job-poster.ts — who posted a job (#182) and contact details left behind by someone who went (#186). */
  poster: {
    you: "你发布的",
    teammate: (name: string) => `${name}发布`,
    left: (email: string) => `${email}发布（已离开团队）`,
    deleted: "已删除的账号发布",
    staleContact: (who: string) => `联系方式是${who}填的，求职者可能联系不到人。请改成现在负责招聘的人。`,
    staleFromLeft: (email: string) => `已离开团队的 ${email}`,
    staleFromDeleted: "一个已删除的账号",
  },

  /** JobStats.tsx — 职位数据, one job over the last 14 days. */
  stats: {
    back: "← 职位管理",
    heading: "职位数据",
    /** After the job's title, which is marked as the employer's own words. */
    subtitleRest: " · 最近 14 天",
    notFound: "找不到这个职位，或者它不属于你登录的店铺。",
    backToManage: "回到职位管理",
    totals: { views: "浏览", chats: "发起聊天", contactViews: "查看联系方式" },
    funnelTitle: "申请到录用",
    funnelDescription: "从发布到现在。约面试不算已取消的；录用是在申请人里标了「已录用」的人。",
    funnel: { applied: "申请", interviewed: "约面试", hired: "录用" },
    byDayTitle: "按天",
    byDayDescription: "浏览：同一个浏览器一天只算一次。发起聊天：求职者第一次就这个职位发消息。",
    tableCaption: "最近 14 天每天的浏览、发起聊天和查看联系方式次数",
    columns: { day: "日期", views: "浏览", chats: "聊天", contact: "联系方式" },
    contactPrivateNote: "这个职位不公开联系方式，在聊天里交换。",
  },

  /** DuplicateJobNote.tsx — 重复职位提醒 (#196), before publishing. */
  duplicate: {
    andMore: (n: number) => `等 ${n} 条`,
    pendingReview: "（审核中）",
    closesOn: (closeDate: string) => `（${closeDate}截止）`,
    /** Around the job's own title, which is rendered as the employer wrote it. */
    noteBefore: "你已经有一条在招的「",
    noteAfter: (when: string, andMore: string) =>
      `」${when}${andMore}。要多招几个人，续期或编辑那条就行；确实是另一份工（比如另一家门店、另一个班次），照常发布。`,
    link: "去看看那条",
  },

  /** job-reminders.ts — 将截止 reminders (#69) in the workspace and in 通知. */
  reminders: {
    /** The notification type (closing-notifications.ts). */
    type: "招聘",
    endingTitle: (title: string, untilClose: string) => `「${title}」${untilClose}`,
    endingDetail: "还要招人就续期，招到了就结束招聘",
    timedOutTitle: (title: string) => `「${title}」已截止`,
    timedOutDetail: (days: number) => `还可以续期 ${days} 天，之后只能重新发布`,
  },

  /** ShareTexts.tsx — the shell around the ready-made posts; the posts themselves stay Chinese. */
  share: {
    heading: "发到其他平台",
    tabsLabel: "平台",
    platforms: { wechat: "微信群", xiaohongshu: "小红书", skykiwi: "Skykiwi" },
    hints: {
      wechat: "短一点，群里一眼能看完。",
      xiaohongshu: "第一行做标题，话题标签放最后。",
      skykiwi: "论坛帖，中英文完整信息。",
    },
    contactPublicNote: "文案里没有联系方式，求职者点链接查看。",
    contactPrivateNote: "文案里没有联系方式，求职者点链接后在聊天里联系你。",
    textLabel: (platform: string) => `${platform}文案`,
    copyLabel: (platform: string) => `复制${platform}文案`,
  },
};

export const employerJobsMessages: Dictionary<typeof employerJobsZh> = {
  zh: employerJobsZh,
  en: {
    pageTitles: {
      manage: "My jobs",
      stats: "Job stats",
    },

    manage: {
      heading: "My jobs",
      postNew: "Post a new job",
      searchLabel: "Search job titles",
      searchPlaceholder: "Search job titles",
      tabsLabel: "By status",
      tabs: {
        all: "All",
        active: "Open",
        ending: "Closing soon",
        pendingReview: "Under review",
        timedOut: "Closed",
        closed: "Ended",
        removed: "Taken down",
      },
      banned: "This employer account is suspended. All its jobs are taken down and it cannot post again.",
      loading: "Loading jobs",
      noticeSeparator: ": ",
      noneYet: "You haven't posted a job yet.",
      noneInTab: "No jobs with this status.",
      noMatch: (query) => `No jobs with “${query}” in the title.`,
      noMatchInTab: (query) => `No jobs with this status have “${query}” in the title.`,
    },

    job: {
      editContact: "Edit contact details",
      last14Days: "Last 14 days",
      renewedTimes: (n) => (n === 1 ? "Renewed once" : `Renewed ${n} times`),
      rolesTodo: "No role type picked yet, so this doesn't count towards suggested candidates.",
      rolesPick: "Pick one",
      takenDown: "This job was taken down by our moderators. Get in touch if you think this is wrong.",
      pendingReview: "It shows publicly once it's approved.",
      endingNote: (closeDate) =>
        `Closes ${closeDate}. Renew it if you're still hiring — it keeps its place in the list.`,
      timedOutNote: (closeDate, days) =>
        days === 1
          ? `Closed ${closeDate}, so job seekers can't see it. You can still renew it for 1 more day.`
          : `Closed ${closeDate}, so job seekers can't see it. You can still renew it for ${days} more days.`,
      renew: "Renew",
      republishNoteStart: "It closed more than 14 days ago, so it can't be renewed. If you're still hiring,",
      republishNoteLink: "repost",
      republishNoteEnd: "it as a new job with the same content. It will be checked again under the current rules.",
      closeSubmit: "End hiring",
      hiresSubmit: "Save",
      renewDone: (days, closeDate) => `Renewed for ${days} days, closes ${closeDate}`,
      closeDone: "Hiring ended",
      closeDoneWithHires: (hires) => `Hiring ended, ${hires}`,
      hiresDone: (hires) => `Saved, ${hires}`,
    },

    actions: {
      moreMenuLabel: (title) => `More for: ${title}`,
      refreshDone: "Moved to the top",
      view: "View",
      edit: "Edit",
      renew: "Renew",
      republish: "Repost",
      refresh: "Move to top",
      share: "Copy a post",
      hideShare: "Hide the posts",
      copy: "Copy to a new job",
      close: "End hiring",
      recordHires: "Record how many you hired",
      correctHires: "Change how many you hired",
    },

    numbers: {
      views: (n) => (n === 1 ? "1 view" : `${n} views`),
      chats: (n) => (n === 1 ? "1 person chatted" : `${n} people chatted`),
      noChats: "Nobody has chatted yet",
      contactViews: (n) => (n === 1 ? "Contact details shown once" : `Contact details shown ${n} times`),
      contactPrivate: "Not public · swapped in chat",
      noApplicants: "0 applicants",
      applicants: (n) => (n === 1 ? "1 application" : `${n} applications`),
      applicantsWithNew: (total, unseen) =>
        `${total === 1 ? "1 application" : `${total} applications`} · ${unseen} new`,
    },

    status: {
      tag: {
        active: "Open",
        pendingReview: "Under review",
        expired: "Ended",
        removed: "Taken down",
        ending: "Closing soon",
        timedOut: "Closed",
      },
      expiry: {
        pendingReview: (days) => `The ${days} days start once it's approved`,
        closesToday: "Closes today",
        closesInDays: (days) => (days === 1 ? "Closes in 1 day" : `Closes in ${days} days`),
        renewableFor: (days) => (days === 1 ? "Can be renewed for 1 more day" : `Can be renewed for ${days} more days`),
        noLongerRenewable: "Can no longer be renewed",
      },
      refresh: {
        removed: "Taken down",
        pendingReview: "Can only be moved to the top once approved",
        expired: "Closed, can't be moved to the top",
        today: "Already moved to the top today",
      },
      renew: {
        removed: "Taken down",
        pendingReview: "Can only be renewed once approved",
        tooLate: (days) => `Closed more than ${days} days ago, can't be renewed`,
        farEnough: (days) => `A job can close at most ${days} days from now, so there's no need to renew`,
      },
    },

    hires: {
      question: (product) => `Did you hire anyone through ${product}?`,
      optional: "(you can skip this)",
      hired: "Yes, I hired someone",
      none: "No / not sure",
      countLabel: "How many you hired",
      countOption: (n) => (n === 1 ? "1 person" : `${n} people`),
      why: (product) => `This is only used to count how many people ${product} has helped find work.`,
      cancel: "Cancel",
      chooseAnswer: "Choose “Yes, I hired someone” or “No / not sure”.",
      countRange: (max) => `Enter a number from 1 to ${max}.`,
      hiredCount: (n) => (n === 1 ? "Hired 1 person" : `Hired ${n} people`),
      noneHired: (product) => `Nobody hired through ${product}`,
    },

    renew: {
      question: "Renew for how long?",
      days: (days) => (days === 1 ? "1 day" : `${days} days`),
      closesOn: (closeDate) => `· closes ${closeDate}`,
      note: (latestDays) =>
        `The closing date moves back and the job keeps its place in the list; at most ${latestDays} days from now. It is checked again under the current rules before it is renewed.`,
      submit: "Renew",
      cancel: "Cancel",
    },

    poster: {
      you: "Posted by you",
      teammate: (name) => `Posted by ${name}`,
      left: (email) => `Posted by ${email} (no longer in the team)`,
      deleted: "Posted by a deleted account",
      staleContact: (who) =>
        `The contact details were filled in by ${who}, so job seekers may not reach anyone. Change them to whoever is hiring now.`,
      staleFromLeft: (email) => `${email}, who has left the team`,
      staleFromDeleted: "a deleted account",
    },

    stats: {
      back: "← My jobs",
      heading: "Job stats",
      subtitleRest: " · last 14 days",
      notFound: "This job doesn't exist, or it doesn't belong to the business you're signed in as.",
      backToManage: "Back to my jobs",
      totals: { views: "Views", chats: "Chats started", contactViews: "Contact details shown" },
      funnelTitle: "From application to hire",
      funnelDescription:
        "Since the job was posted. Interviews don't count cancelled ones; hires are the applicants you marked as hired.",
      funnel: { applied: "Applied", interviewed: "Interviews", hired: "Hired" },
      byDayTitle: "Day by day",
      byDayDescription:
        "Views: one browser counts once a day. Chats started: a job seeker's first message about this job.",
      tableCaption: "Views, chats started and contact details shown for each of the last 14 days",
      columns: { day: "Date", views: "Views", chats: "Chats", contact: "Contact" },
      contactPrivateNote: "This job doesn't show contact details publicly; they're swapped in chat.",
    },

    duplicate: {
      andMore: (n) => (n === 2 ? " and 1 other" : ` and ${n - 1} others`),
      pendingReview: " (under review)",
      closesOn: (closeDate) => ` (closes ${closeDate})`,
      noteBefore: "You already have “",
      noteAfter: (when, andMore) =>
        `” open${when}${andMore}. To hire a few more people, just renew or edit that one; if this really is a different job (another shop, another shift), post it as usual.`,
      link: "Go and look at it",
    },

    reminders: {
      type: "Hiring",
      endingTitle: (title, untilClose) => `“${title}” — ${untilClose}`,
      endingDetail: "Renew it if you're still hiring, or end hiring if you've found someone",
      timedOutTitle: (title) => `“${title}” has closed`,
      timedOutDetail: (days) =>
        days === 1
          ? "You can renew it for 1 more day; after that you can only repost it"
          : `You can renew it for ${days} more days; after that you can only repost it`,
    },

    share: {
      heading: "Post it elsewhere",
      tabsLabel: "Platform",
      platforms: { wechat: "WeChat group", xiaohongshu: "Xiaohongshu", skykiwi: "Skykiwi" },
      hints: {
        wechat: "Short, so a group can read it at a glance.",
        xiaohongshu: "The first line is the title; the hashtags go at the end.",
        skykiwi: "A forum post, with the full details in Chinese and English.",
      },
      contactPublicNote: "The post has no contact details; job seekers follow the link to see them.",
      contactPrivateNote: "The post has no contact details; job seekers follow the link and chat with you.",
      textLabel: (platform) => `${platform} post`,
      copyLabel: (platform) => `Copy the ${platform} post`,
    },
  },
};
