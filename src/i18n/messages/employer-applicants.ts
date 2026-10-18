// Round 20 (ADR 0023): 申请人、面试、推荐人才. Covers src/components/employer/JobApplicants.tsx,
// src/components/employer/applicant-filter.ts, src/components/employer/InterviewInvite.tsx,
// src/components/employer/CandidateRecommendations.tsx, the errors src/app/[lang]/employer/interview-actions.ts sends to
// InterviewInvite, and the titles of src/app/[lang]/employer/jobs/[id]/applicants/page.tsx,
// src/app/[lang]/employer/candidates/page.tsx and src/app/[lang]/employer/candidates/loading.tsx.
import type { Dictionary } from "@/i18n/messages";

const employerApplicantsZh = {
  /** src/app/[lang]/employer/jobs/[id]/applicants/page.tsx */
  applicantsPage: {
    metaTitle: "申请人",
  },

  /** src/components/employer/JobApplicants.tsx */
  jobApplicants: {
    notFound: "找不到这个职位，或者它不属于你登录的店铺。",
    backToJobs: "回到职位管理",
    back: "← 职位管理",
    title: "申请人",
    /** After the job's title, which is marked as the employer's own words. */
    jobSummaryCount: (n: number) => ` · ${n} 个申请`,
    privacyNote:
      "申请里没有对方的联系方式。标「不合适」时，对方只会看到「雇主已看过」。标「已录用」时对方会收到通知；职位结束后，没被录用的人会收到「职位已结束」。",
    saveFailed: "没有保存，请再试一次。",
    marked: (decision: string) => `已标记「${decision}」`,
    markCleared: "已取消标记",
    empty: "还没有人申请这个职位。",
    emptyInFilter: "这一类还没有人。",
    listLabel: "申请人列表",
    cardLabel: (name: string) => `申请人 ${name}`,
    isNew: "新",
    appliedAt: (when: string) => `${when} 申请`,
    /** Before the applicant's own note, which is marked as theirs. */
    noteLabel: "附言：",
    startChat: "发起聊天",
    markGroupLabel: (name: string) => `标记 ${name}`,
  },

  /** src/components/employer/applicant-filter.ts (合适 / 不合适 / 已录用 come from DECISION_LABELS) */
  applicantFilter: {
    tabsLabel: "按处理状态",
    tab: (label: string, n: number) => `${label} ${n}`,
    all: "全部",
    open: "未处理",
  },

  /** src/components/employer/InterviewInvite.tsx */
  interviewInvite: {
    statusLabel: (name: string) => `和${name}的面试`,
    timesGiven: (times: string) => `给的时间：${times}`,
    cancelFailed: "没有取消成功，请再试一次。",
    sendFailed: "网络有问题，没有发出去，请再试一次。",
    sent: "邀约已发出",
    changeTimes: "改时间",
    invite: "约面试",
    cancelInterview: "取消面试",
    formLabel: (name: string) => `约${name}面试`,
    timeLegend: "面试时间",
    giveTimes: "给具体时间",
    callFirst: "电话联系后再定",
    timesHint: "奥克兰时间。想给几个就给几个，对方从里面选一个，或回一句自己方便的时间。",
    timeLabel: (i: number) => `时间 ${i}`,
    removeTimeLabel: (i: number) => `删除时间 ${i}`,
    removeTime: "删除",
    addTime: "再加一个时间",
    modeLabel: "面试方式（选填）",
    modePlaceholder: "不填",
    placeLabel: "地点或说明（选填）",
    placePlaceholder: "例如：到店找经理",
    noteLabel: "附言（选填）",
    noContactNote: "邀约里不带你的联系方式；要交换，在聊天里发起。",
    incompleteTime: "有一个时间不完整，请把日期和时刻都选上",
    sendAgain: "发出新的邀约",
    send: "发出邀约",
    collapse: "收起",
  },

  /** src/app/[lang]/employer/interview-actions.ts, shown by InterviewInvite */
  interviewActions: {
    signInAsEmployer: "请用店铺身份登录后再约面试",
    applicationGone: "找不到这个申请，可能对方已经撤回",
  },

  /** src/app/[lang]/employer/application-notifications.ts: a new application, in 通知 */
  notifications: {
    type: "申请",
    applied: (name: string, title: string) => `${name}申请了${title}`,
    yourJob: "你的职位",
    note: (note: string) => `附言：${note}`,
    noNote: "点开看对方的资料",
  },

  /** src/app/[lang]/employer/candidates/page.tsx, src/app/[lang]/employer/candidates/loading.tsx */
  candidatesPage: {
    metaTitle: "推荐人才",
    loading: "正在加载推荐人才",
  },

  /** src/components/employer/CandidateRecommendations.tsx */
  candidateRecommendations: {
    loadingJobs: "加载招聘职位…",
    /** Before the business's name, which is marked as its own words. */
    workspaceBefore: "雇主工作台 · ",
    title: "推荐人才",
    intro: "演示候选资料 · 匹配分仅供参考，班次与实际经验需双方确认。",
    noOpenJobs: "暂无招聘中的职位",
    postJob: "发布招聘",
    manageJobs: "管理已有职位",
    filtersLabel: "推荐条件",
    jobLabel: "招聘职位",
    jobOption: (jobTitle: string, area: string) => `${jobTitle} · ${area}`,
    hoursRange: (min: number, max: number) => `${min}–${max} 小时 / 周`,
    hoursUnknown: "工时待沟通",
    seeRequirements: "查看职位要求",
    searchLabel: "搜索求职者",
    searchPlaceholder: "姓名、技能或经验",
    minimumLabel: "最低匹配分",
    minimumAll: "全部",
    minimumAtLeast: (score: number) => `${score} 分及以上`,
    listTitle: (n: number) => `推荐求职者 · ${n} 人`,
    sortNote: "匹配分从高到低",
    noMatches: "暂无符合条件的求职者",
    lowMatchesLabel: "匹配度较低的求职者",
    moreLowMatches: (n: number) => `另外 ${n} 位匹配度较低`,
    sourceDemo: "演示简历",
    sourcePublic: "公开主页",
    headlineEmpty: "求职意向待完善",
    score: "匹配分",
    scoreUnknown: "待确认",
    scoreOutOf: "/100",
    concernItem: (label: string, status: string) => `${label}${status}`,
    concerns: (items: readonly string[]) => `需关注：${items.join("、")}`,
    allMatched: "已填写条件均匹配；具体班次需沟通",
    hideResume: "收起简历",
    showResume: "简历与匹配分析",
    startChat: "发起聊天",
    resumeLabel: "求职简历",
    resumeTitle: "求职简历",
    bioEmpty: "个人介绍待补充",
    skills: "技能",
    wants: "求职意向",
    fieldEmpty: "待补充",
    analysisLabel: "匹配分析",
    analysisTitle: "匹配分析",
    coverage: (percent: number) => `可核对资料覆盖 ${percent}%`,
    weighting: "按技能、经验、语言、用工形式、地区、工时、薪资加权；资料缺失不计匹配分。",
    notScored: "不计分",
    earned: (earned: number, weight: number) => `${earned} / ${weight}`,
    requirement: (text: string) => `职位：${text}`,
    matchStatus: {
      matched: "匹配",
      partial: "部分匹配",
      mismatch: "不匹配",
      unknown: "待确认",
      not_required: "职位未要求",
    },
  },
};

export const employerApplicantsMessages: Dictionary<typeof employerApplicantsZh> = {
  key: "employerApplicants",
  zh: employerApplicantsZh,
};
