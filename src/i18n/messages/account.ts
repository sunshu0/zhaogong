// Round 20 (ADR 0023): 我的 and 数据与账号 — AccountHome.tsx, MyDataPanel.tsx, todos.ts, profile-checklist.ts,
// identity-switch.ts, moderator-entry.ts, app/account (pages, loading, actions). 「企业主页」「我的主页」 as they read
// today; step 1 settles the Chinese names (导师决定 7), and these follow.

import type { Dictionary } from "@/i18n/messages";

const accountZh = {
  title: "我的",
  loading: "正在加载我的",
  signInFor: "登录后查看你的资料、通知和记录",
  role: {
    current: "当前身份：",
    seeker: "求职者",
    employer: "雇主",
    // ADR 0043: a staff account.
    admin: "管理员",
    moderator: "审核员",
    staffNote: "这个账号只用来审核，找工作、招聘的功能都不在这里。",
    toSeeker: "切换为求职者",
    toEmployer: (business: string) => `切换为雇主（${business}）`,
    setUpHiring: "开通雇主身份",
    // identity-switch.ts
    employerGone: "这个账号的雇主身份已不可用，请重新开通。",
    checkFailed: "暂时无法核对雇主身份，请稍后重试。",
  },
  signOut: "退出登录",
  signOutFailed: "网络有问题，还没有退出登录，请再试一次。",
  // The rows of 我的: a label, and a line under it where there is one.
  rows: {
    workspace: "总览",
    workspaceDetail: "要处理的事",
    notifications: "通知",
    businessPage: "企业主页",
    businessPageDetail: "企业介绍和招聘联系人",
    profile: "我的主页",
    profileDetail: "雇主看到的资料和简历",
    candidates: "推荐人才",
    verify: "企业验证",
    verifyDetail: "申请「已验证企业」标识，审核员人工核对",
    team: "团队",
    teamDetail: "邀请同事一起管理职位和聊天",
    saved: "收藏和进度",
    savedDetail: "收藏的职位和求职进度",
    alerts: "职位提醒",
    alertsDetail: "有符合条件的新职位时通知你",
    history: "浏览与举报",
    historyDetail: "看过的职位和举报记录",
    admin: "审核后台",
    adminDetail: "审核职位和举报（审核员）",
    data: "数据与账号",
    dataDetail: "导出我的数据、删除账号",
  },
  // todos.ts: what waits for the user, on 总览 and 我的.
  todos: {
    // The title or the detail of each to-do is either these words or what someone wrote (a name, a job title),
    // never both, so the list can mark the person's words as theirs (lang).
    exchangeAsked: (what: string) => `想和你交换${what}，等你同意或拒绝`,
    exchangeKinds: { contact: "联系方式", resume: "简历与企业资料" },
    newMessages: (count: number) => `发来 ${count} 条新消息`,
    newApplications: (count: number) => `${count} 个新申请`,
    jobInReview: "审核中：通过后会出现在职位列表，不需要你操作",
    verificationRejected: "企业验证没有通过",
    // The reason's words come from B's employer-verify dictionary.
    verificationRejectedDetail: (reason: string | null) => `${reason ? `${reason}，` : ""}改好资料重新提交`,
    verificationInReview: "企业验证审核中",
    verificationInReviewDetail: "审核员核对后会通知你，不需要你操作",
    profileMissing: (employer: boolean, count: number) => `${employer ? "企业资料" : "资料"}还差 ${count} 项`,
    // The first few missing items, with 等 when there are more.
    missingItems: (labels: readonly string[], more: boolean) => `${labels.join("、")}${more ? " 等" : ""}`,
  },
  // profile-checklist.ts: the items a page still lacks.
  checklist: {
    business: {
      bio: "企业介绍",
      location: "地区",
      verification: "企业验证",
      contactName: "招聘联系人",
      name: "企业名称",
      avatar: "头像",
      headline: "招聘简介",
      languages: "语言",
      availability: "联系时间",
    },
    seeker: {
      availability: "可上班时间",
      location: "地区",
      expectedMinPay: "期望时薪",
      languages: "语言",
      experience: "经验",
      name: "称呼",
      avatar: "头像",
      headline: "一句话介绍",
      skills: "技能",
      bio: "个人介绍",
    },
  },
  data: {
    title: "数据与账号",
    loading: "正在加载数据与账号",
    signInFor: "登录后可以导出你的数据或删除账号",
    exportTitle: "导出我的数据",
    exportDescription:
      "下载一个 JSON 文件，包含我们保存的关于你的全部数据：账号、求职和雇主两种身份的资料、发布的职位、聊天记录、已读通知、收藏和求职进度、职位提醒、举报和浏览记录。",
    exportDeviceNote: "资料、举报和浏览记录有一部分只存在这台设备上；在别的设备上导出，文件里会少这一部分。",
    exportButton: "下载我的数据",
    exporting: "正在导出…",
    exported: (file: string) => `已下载 ${file}`,
    exportFailed: "导出没有成功，请稍后再试",
    deleteTitle: "删除账号",
    deleteWhat: [
      "删除账号、登录记录、两种身份的聊天记录和已读通知、收藏和求职进度、职位提醒，以及这台设备上的资料、举报和浏览记录。",
      "雇主身份发布的职位全部下架，职位上的联系方式一并清除。",
      "店铺本身、举报和审核记录、联系方式的查看次数会保留，但不再带你的邮箱：这些记录关系到其他用户和平台安全。",
      "和你聊过天的人，他们自己那份聊天记录不会删除。",
      "删除后立刻退出登录，不能恢复。以后可以用同一个邮箱重新注册，会是一个新账号。",
    ],
    // Around the email in bold: 输入你的登录邮箱 <email> 确认
    confirmBefore: "输入你的登录邮箱",
    confirmAfter: "确认",
    deleteButton: "永久删除账号",
    deleting: "正在删除…",
    deleteFailed: "删除没有成功，请稍后再试",
    deleted: "账号已删除",
    deletedText: "你已经退出登录。账号、聊天记录和这台设备上的资料都已清除；开通过雇主身份的，发布的职位也已下架。",
    seeJobs: "去看职位",
  },
  // app/account/actions.ts
  errors: {
    signInFirst: "请先登录",
    noAccount: "找不到这个账号",
    emailMismatch: "输入的邮箱和当前登录的邮箱不一致",
    lastModerator: "你是最后一位审核员。请先在审核后台添加另一位审核员，再删除账号。",
    lastAdmin: "你是团队里唯一的管理员。请先在「团队」里把另一位成员设为管理员，再删除账号。",
  },
};

export const accountMessages: Dictionary<typeof accountZh> = { key: "account", zh: accountZh };
