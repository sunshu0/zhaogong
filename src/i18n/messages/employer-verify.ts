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
    /** Followed by the badge itself: 「悦美发型工作室 现在是 [未验证]」. */
    nowIs: (business: string) => `${business} 现在是`,
    nzbn: (number: string) => `NZBN ${number}`,
    submitted: "已提交，审核员核对后会在通知里告诉你结果。",
    banned: "账号已被停用，不能申请验证。",
    nothingLeft: (badge: string) => `你的店铺已经是「${badge}」，不需要再申请。`,
    adminOnly: (admins: readonly string[]) =>
      `只有团队管理员能申请企业验证。请找你们店的管理员（${admins.join("、")}）。`,
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
    rejection: (reason: string, note: string) => `${reason}：${note}`,
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
  zh: employerVerifyZh,
  en: {
    page: {
      title: "Business verification",
      description:
        "Check your business against the New Zealand business register by name or NZBN, and show the Verified business badge on your jobs.",
    },

    verify: {
      heading: "Business verification",
      nowIs: (business) => `${business} is currently`,
      nzbn: (number) => `NZBN ${number}`,
      submitted: "Sent. A moderator will check it and tell you the result in your notifications.",
      banned: "This account is suspended, so it cannot apply for verification.",
      nothingLeft: (badge) => `Your business is already "${badge}", so there is nothing to apply for.`,
      adminOnly: (admins) =>
        `Only a team admin can apply for business verification. Ask an admin (${admins.join(", ")}).`,
      backToJobs: "Back to my jobs",
    },

    request: {
      sectionLabel: "Verification application",
      pendingTitle: "Verification under review",
      approvedTitle: (badge) => `Approved: ${badge}`,
      rejectedTitle: "Your last application was not approved",
      pendingNote:
        "A moderator checks the business register and calls the business phone number listed in public sources to confirm that you work there. You can keep posting jobs while they check; your badge stays Not verified. You will get the result in your notifications.",
      rejection: (reason, note) => `${reason}: ${note}`,
      appliedFor: "Applied for",
      business: "Business",
      contact: "Contact",
      sentAt: "Sent",
      contactRoleOpen: " (",
      contactRoleClose: ") · ",
    },

    form: {
      againTitle: "Fix the details and apply again",
      findTitle: "1. Find your business in the business register",
      queryLabel: "Business name or NZBN",
      queryPlaceholder: "For example: Demo Yuemei or 9429000000004",
      search: "Search",
      demoRegisterNote:
        "The demo searches a sample register. The real site connects to the New Zealand Business Number (NZBN) register.",
      resultLine: (nzbn) => `NZBN ${nzbn} · Trading names: `,
      namesJoiner: ", ",
      statusRegistered: "Register status: registered",
      statusRemoved: "Register status: removed",
      choose: "This is my business",
      whoTitle: "2. Who is applying",
      changeBusiness: "Choose another",
      kindLegend: "Which badge are you applying for",
      kindBusinessVerified: "Verified business: the business really exists in the business register",
      kindAccredited:
        "Accredited employer: the business is on Immigration New Zealand's public accredited employer list",
      contactNameLabel: "Contact name",
      contactRoleLabel: "Your role in the business",
      contactRolePlaceholder: "For example: director, owner, manager",
      companyPhoneLabel: "Business phone number",
      companyPhoneHint:
        "Give the number the business lists publicly. A moderator calls the business number they find in public sources, not only this one.",
      websiteLabel: "Website or Facebook page (optional)",
      websitePlaceholder: "https://",
      submit: "Submit for review",
      submitting: "Sending…",
    },

    meaning: {
      isTitle: 'What "Verified business" means',
      isBody:
        "A moderator checked the New Zealand business register: the business exists, its registration is current, and they called the business phone number listed in public sources to confirm that the applicant works there. Jobs show the registered business name and NZBN. Job seekers are more willing to contact an employer with a badge.",
      isNotTitle: "What it does not mean",
      isNotPoints: [
        "It is not our guarantee of pay, hours or working conditions.",
        '"Accredited employer" only means the business is on Immigration New Zealand\'s public accredited employer list. Neither badge means any visa can be arranged.',
        "It does not endorse what a job says. Job seekers can still report a job that charges a fee, pays below the adult minimum wage, or anything else.",
      ],
    },

    rejectReasons: {
      register_mismatch: "Doesn't match the register",
      phone_unreachable: "Couldn't reach anyone by phone",
      impersonation: "Using another business's identity",
      other: "Other",
    },

    checklist: {
      register: {
        label: "Business register",
        detail: "This NZBN is registered, and the legal business name matches the business name the employer gave.",
        nzbnLink: "Check the NZBN register",
        companiesOfficeLink: "Check the Companies Office",
      },
      applicant: {
        label: "Who is applying",
        detail:
          "The applicant's name is on the register as a director or shareholder. If it is not, confirm their role in the business on the phone call in the next step.",
        directorsLink: "Check directors and shareholders",
      },
      phone: {
        label: "Phone check",
        detail:
          "Call the business number you find in public sources (its website, Google Maps, the register), not the number the applicant gave, and ask whether this person posts jobs on 找工 for the business.",
        mapsLink: "Find the number on Google Maps",
      },
      website: {
        label: "Website or Facebook",
        detail: "It exists and is the same business (address and name match). Skip it if there is none.",
      },
      accredited: {
        label: "Accredited employer list",
        detail:
          "Find the business by NZBN or name on Immigration New Zealand's public accredited employer list, with a current status.",
        listLink: "Check the accredited employer list",
      },
    },

    errors: {
      noRejectReason: "Choose a reason for rejecting it.",
      noRejectNote: "Write a note about the rejection. The employer will see it.",
      noBusinessChosen: "Choose your business in the business register first.",
      noContactName: "Enter the contact name.",
      noContactRole: "Enter your role in the business.",
      badPhone: "Enter the business phone number (digits, and + and spaces if you need them).",
      badWebsite: "Enter the full web address of the website or Facebook page, starting with http:// or https://.",
    },

    register: {
      nzbnLength: "An NZBN is 13 digits. Check the number.",
      nzbnNotFound: "That NZBN is not in the business register.",
      queryTooShort: "Enter at least two characters.",
      nameNotFound: "Nothing found in the business register. Try another name, or enter the NZBN.",
    },

    notifications: {
      type: "Verification",
      approvedTitle: (badge) => `Business verification approved: ${badge}`,
      rejectedTitle: "Business verification was not approved",
      approvedDetail: (badge) => `Your jobs will show "${badge}" and your registered business name.`,
      rejectedDetail: (reason, note) => `${reason}: ${note}. Fix the details and apply again.`,
    },
  },
};
