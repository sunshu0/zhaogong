// Round 20 (ADR 0023): 企业验证. Covers components/employer/VerifyBusiness.tsx, components/employer/verification.ts
// (its checklist and rejection reasons: /admin reads them from here instead of writing its own),
// components/employer/business-register.ts and app/employer/verification-notifications.ts, plus the page title of
// /employer/verify. The badge names themselves stay in i18n/labels.ts (VERIFICATION_LABELS).
import type { Dictionary } from "@/i18n/messages";

const employerVerifyZh = {
  page: {
    title: "企业验证",
    description: "用公司名称或 NZBN 核对新西兰企业登记，职位显示「已验证企业」标识。",
  },

  /** VerifyBusiness.tsx */
  verify: {
    heading: "企业验证",
    /** Between the business's own name and the badge itself: 「悦美发型工作室 现在是 [未验证]」. */
    nowIs: " 现在是",
    nzbn: (number: string) => `NZBN ${number}`,
    submitted: "已提交，审核员核对后会在通知里告诉你结果。",
    banned: "账号已被停用，不能申请验证。",
    nothingLeft: (badge: string) => `你的店铺已经是「${badge}」，不需要再申请。`,
    /** Around the admins' own names, joined with adminsJoiner (marked separately). */
    adminOnlyBefore: "只有团队管理员能申请企业验证。请找你们店的管理员（",
    adminsJoiner: "、",
    adminOnlyAfter: "）。",
    backToJobs: "回到职位管理",
  },

  /** The latest application, in VerifyBusiness.tsx. */
  request: {
    sectionLabel: "验证申请",
    pendingTitle: "验证审核中",
    approvedTitle: (badge: string) => `已通过：${badge}`,
    rejectedTitle: "上次申请没有通过",
    pendingNote:
      "审核员会核对企业登记，并打公开渠道查到的公司电话确认你在这家公司。审核期间照样可以发职位，标识显示「未验证」。结果会在通知里告诉你。",
    /** Between the reason and the moderator's own note (marked separately). */
    rejectionJoiner: "：",
    appliedFor: "申请",
    business: "公司",
    contact: "联系人",
    sentAt: "提交",
    /** Around the contact's role, between the name and the phone (both marked as the employer's own words). */
    contactRoleOpen: "（",
    contactRoleClose: "）· ",
  },

  /** The application form, in VerifyBusiness.tsx. */
  form: {
    againTitle: "改好资料，重新提交",
    findTitle: "1. 在企业登记里找到你的公司",
    queryLabel: "公司名称或 NZBN",
    queryPlaceholder: "例如：Demo Yuemei 或 9429000000004",
    search: "查询",
    demoRegisterNote: "演示版查的是一份示例登记；正式版会连新西兰企业登记（NZBN）。",
    /** Before the register's trading names, which are marked as the business's own words. */
    resultLine: (nzbn: string) => `NZBN ${nzbn} · 商号：`,
    namesJoiner: "、",
    statusRegistered: "登记状态：正常",
    statusRemoved: "登记状态：已注销",
    choose: "这是我的公司",
    whoTitle: "2. 谁在申请",
    changeBusiness: "换一家",
    kindLegend: "申请哪个标识",
    kindBusinessVerified: "已验证企业：公司在企业登记里真实存在",
    kindAccredited: "认证雇主：公司在移民局公开的认证雇主名单（Accredited Employer）上",
    contactNameLabel: "联系人姓名",
    contactRoleLabel: "你在公司的职务",
    contactRolePlaceholder: "例如：董事、店主、经理",
    companyPhoneLabel: "公司电话",
    companyPhoneHint: "填公司对外公开的电话。审核员会打公开渠道查到的公司电话核实，不只打这个号码。",
    websiteLabel: "网站或 Facebook 页面（选填）",
    websitePlaceholder: "https://",
    submit: "提交审核",
    submitting: "提交中…",
  },

  /** What the badge does and does not mean, in VerifyBusiness.tsx. */
  meaning: {
    isTitle: "「已验证企业」是什么",
    isBody:
      "审核员核对了新西兰企业登记：这家公司真实存在、登记状态正常，并打公开渠道查到的公司电话，确认申请人在这家公司。职位上会显示登记的公司名称和 NZBN。求职者更愿意联系有标识的雇主。",
    isNotTitle: "它不代表什么",
    isNotPoints: [
      "不代表我们担保工资、工时或工作条件。",
      "「认证雇主」只说明这家公司在移民局公开的认证雇主名单上。两种标识都不代表能办理任何签证。",
      "不是对职位内容的背书。求职者遇到收费、低于最低工资等情况，仍然可以举报。",
    ],
  },

  /** verification.ts: the reasons the employer sees when an application is rejected. */
  rejectReasons: {
    register_mismatch: "登记信息对不上",
    phone_unreachable: "电话核实不到人",
    impersonation: "冒用他人公司",
    other: "其他",
  },

  /** verification.ts: what a moderator works through for one application (/admin shows these). */
  checklist: {
    register: {
      label: "企业登记",
      detail: "这个 NZBN 在企业登记里是「已登记」，登记名和雇主填的公司名一致。",
      nzbnLink: "去查 NZBN 登记",
      companiesOfficeLink: "去查 Companies Office",
    },
    applicant: {
      label: "申请人身份",
      detail: "申请人姓名在登记的董事或股东名单上；不在的，在下一步电话里确认他在公司的职务。",
      directorsLink: "去查董事和股东",
    },
    phone: {
      label: "电话核实",
      detail:
        "打公开渠道查到的公司电话（官网、Google 地图、登记信息），不打申请人填的号码，问一句「贵公司是否有这个人在找工发招聘」。",
      mapsLink: "去 Google 地图查电话",
    },
    website: {
      label: "网站或 Facebook",
      detail: "存在且是同一家店（地址、店名对得上）。没有就跳过。",
    },
    accredited: {
      label: "认证雇主名单",
      detail: "在移民局公开的认证雇主名单里，用 NZBN 或公司名查到这家公司，状态是有效。",
      listLink: "去查认证雇主名单",
    },
  },

  /** verification.ts: what the moderator's and the employer's forms refuse. */
  errors: {
    noRejectReason: "请选择驳回理由。",
    noRejectNote: "请写明驳回的说明，雇主会看到。",
    noBusinessChosen: "请先在企业登记里选好你的公司。",
    noContactName: "请填写联系人姓名。",
    noContactRole: "请填写你在公司的职务。",
    badPhone: "请填写公司电话（数字，可带 + 和空格）。",
    badWebsite: "网站或 Facebook 请填完整的网址，以 http:// 或 https:// 开头。",
  },

  /** business-register.ts: what the register search says when it finds nothing. */
  register: {
    nzbnLength: "NZBN 是 13 位数字，请检查一下。",
    nzbnNotFound: "企业登记里没有这个 NZBN。",
    queryTooShort: "请至少输入两个字。",
    nameNotFound: "企业登记里没有找到，请换个名称或直接输入 NZBN。",
  },

  /** verification-notifications.ts */
  notifications: {
    type: "验证",
    approvedTitle: (badge: string) => `企业验证已通过：${badge}`,
    rejectedTitle: "企业验证没有通过",
    approvedDetail: (badge: string) => `你的职位会显示「${badge}」和登记的公司名。`,
    rejectedDetail: (reason: string, note: string) => `${reason}：${note}。改好资料可以重新提交。`,
  },
};

export const employerVerifyMessages: Dictionary<typeof employerVerifyZh> = {
  key: "employerVerify",
  zh: employerVerifyZh,
};
