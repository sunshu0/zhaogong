// Round 20 (ADR 0023): sign-in and setting up hiring — LoginForm.tsx, app/login (page, actions), code-resend.ts,
// seeker/identity.ts and lib/auth/sessions.ts. English per the glossary: sign in, never log in; "sign-in code" the
// first time on a page, then "code".

import type { Dictionary } from "@/i18n/messages";

const loginZh = {
  title: "注册或登录",
  intro: "用邮箱验证码注册或登录，不用设密码。同一个账号可以找工作，也可以开通雇主身份招人。",
  loading: "正在加载",
  checkingAccount: "正在核对你的账号…",
  noScript: "登录需要浏览器开启 JavaScript。职位列表和职位详情不用登录也能看。",
  networkError: "网络有问题，请稍后再试",
  roles: {
    legend: "你想做什么？",
    seekerTitle: "我要找工作",
    seekerText: "浏览职位，和雇主在线沟通、交换联系方式",
    employerTitle: "我要招人",
    employerText: "开通雇主身份，选择或新建你的企业，然后发布招聘",
  },
  signedIn: {
    as: "你已登录：",
    continue: "继续",
    setUpHiring: "开通雇主身份",
    signOut: "退出登录",
  },
  email: {
    label: "邮箱",
    invalid: "请输入正确的邮箱地址",
    send: "获取验证码",
    sending: "正在发送…",
    note: "新邮箱会自动注册。邮箱只用来登录，不会显示给雇主。",
    // The typo hint: said whole to screen readers, and around a button that puts the right address in.
    typoAnnounce: (fix: string) => `邮箱是不是 ${fix}？`,
    typoBefore: "是不是",
    typoAfter: "？",
    typoFixLabel: (fix: string) => `改成 ${fix}`,
  },
  code: {
    sentTo: "验证码已发送到",
    typoQuestion: "地址是不是拼错了？",
    useInstead: (fix: string) => `改用 ${fix}`,
    devNote: "开发环境没有接邮件服务，验证码打印在服务器日志里：",
    validity: (minutes: number, resendMinutes: number) =>
      `${minutes} 分钟内有效。没收到可以 ${resendMinutes} 分钟后重新获取。`,
    label: "验证码",
    placeholder: "6 位数字",
    invalid: "请输入 6 位数字验证码",
    submit: "登录",
    resend: "重新获取验证码",
    resendIn: (seconds: number) => `${seconds} 秒后可重新获取`,
    otherEmail: "换个邮箱",
  },
  // Server Function answers (app/login/actions.ts), in the language of the request.
  errors: {
    sentRecently: (seconds: number) => `验证码刚发过，请 ${seconds} 秒后再获取`,
    noMailService: "邮件服务还没有配置，暂时无法发送验证码",
    noCode: "请先获取验证码",
    expired: "验证码已过期，请重新获取",
    tooManyTries: "错误次数太多，请重新获取验证码",
    wrongCode: (left: number) => `验证码不对，还可以再试 ${left} 次`,
    signInFirst: "请先登录",
    employerFirst: "需要先开通雇主身份",
  },
  hiring: {
    title: "开通雇主身份",
    // Around the signed-in email: 已登录：<email>。选择你的企业…
    signedInAs: "已登录：",
    introAfter: "。选择你的企业，发布的职位会显示这家企业。演示版可以选下面的演示店，或新建企业。",
    legend: "你的企业",
    // One business to choose: its area, its verification badge's words, and whether a team already runs it.
    businessMeta: (area: string, verification: string, claimed: boolean) =>
      `${area} · ${verification}${claimed ? " · 已有团队，需要管理员邀请" : ""}`,
    newTitle: "新建企业",
    newText: "填写店名和地区；企业验证可以以后再做",
    nameLabel: "店名",
    areaLabel: "地区",
    areaPlaceholder: "请选择",
    submit: "开通并开始发布招聘",
    submitting: "正在开通…",
  },
  // seeker/identity.ts: checking the choice, and why binding a business failed.
  identity: {
    nameMissing: "请填写店名",
    nameTooLong: (max: number) => `店名最多 ${max} 个字`,
    areaMissing: "请选择地区",
    businessMissing: "请选择一家店",
    seeker: "求职者",
    employerOf: (business: string) => `雇主 · ${business}`,
    claimed: "这家店已经有团队在用了。请找这家店的管理员在「团队」里邀请你；也可以新建企业。",
    suspended: "这家企业已被停用，不能再绑定。",
    notFound: "找不到这家企业，请重新选择。",
    alreadyBound: "这个账号已经绑定了另一家企业。",
  },
  // The sign-in code email (lib/auth/delivery.ts), in the language of the request that asked for it.
  mail: {
    subject: (code: string) => `找工登录验证码：${code}`,
    body: (code: string, minutes: number) =>
      `你的找工登录验证码是 ${code}，${minutes} 分钟内有效。\n\n不是你本人在登录的话，忽略这封邮件就行，没有验证码别人登录不了你的账号。`,
  },
};

export const loginMessages: Dictionary<typeof loginZh> = {
  zh: loginZh,
  en: {
    title: "Sign in or sign up",
    intro:
      "Sign in or sign up with a code sent to your email — no password. One account can look for work and set up hiring too.",
    loading: "Loading",
    checkingAccount: "Checking your account…",
    noScript: "Signing in needs JavaScript turned on. You can see the job list and job pages without signing in.",
    networkError: "Couldn't reach 找工. Try again in a moment.",
    roles: {
      legend: "What do you want to do?",
      seekerTitle: "Find a job",
      seekerText: "Browse jobs, chat with employers and swap contact details",
      employerTitle: "Hire people",
      employerText: "Set up hiring, choose or add your business, then post jobs",
    },
    signedIn: {
      as: "You're signed in as ",
      continue: "Continue",
      setUpHiring: "Set up hiring",
      signOut: "Sign out",
    },
    email: {
      label: "Email",
      invalid: "Enter a valid email address",
      send: "Send code",
      sending: "Sending…",
      note: "A new email address signs you up. Your email is only for signing in; employers never see it.",
      typoAnnounce: (fix) => `Did you mean ${fix}?`,
      typoBefore: "Did you mean",
      typoAfter: "?",
      typoFixLabel: (fix) => `Change to ${fix}`,
    },
    code: {
      sentTo: "We sent a sign-in code to",
      typoQuestion: "Is the address misspelt?",
      useInstead: (fix) => `Use ${fix}`,
      devNote: "No mail service in development: the code is in the server log:",
      validity: (minutes, resendMinutes) =>
        `The code works for ${minutes} minutes. No email? You can ask for a new one after ${resendMinutes === 1 ? "a minute" : `${resendMinutes} minutes`}.`,
      label: "Sign-in code",
      placeholder: "6 digits",
      invalid: "Enter the 6-digit code",
      submit: "Sign in",
      resend: "Send a new code",
      resendIn: (seconds) => `New code in ${seconds} s`,
      otherEmail: "Use another email",
    },
    errors: {
      sentRecently: (seconds) => `We just sent a code. You can ask for another in ${seconds} s.`,
      noMailService: "Email isn't set up yet, so we can't send codes for now.",
      noCode: "Ask for a code first",
      expired: "The code has expired. Ask for a new one.",
      tooManyTries: "Too many wrong tries. Ask for a new code.",
      wrongCode: (left) =>
        left === 1 ? "That code isn't right. 1 try left." : `That code isn't right. ${left} tries left.`,
      signInFirst: "Sign in first",
      employerFirst: "Set up hiring first",
    },
    hiring: {
      title: "Set up hiring",
      signedInAs: "Signed in as ",
      introAfter:
        ". Choose your business; the jobs you post show it. In the demo you can pick a demo shop below or add a business.",
      legend: "Your business",
      businessMeta: (area, verification, claimed) =>
        `${area} · ${verification}${claimed ? " · Has a team: ask its admin for an invite" : ""}`,
      newTitle: "Add a business",
      newText: "Enter the business name and area; business verification can wait",
      nameLabel: "Business name",
      areaLabel: "Area",
      areaPlaceholder: "Choose",
      submit: "Set up and start posting",
      submitting: "Setting up…",
    },
    identity: {
      nameMissing: "Enter the business name",
      nameTooLong: (max) => `The business name can be ${max} characters at most`,
      areaMissing: "Choose an area",
      businessMissing: "Choose a business",
      seeker: "Job seeker",
      employerOf: (business) => `Employer · ${business}`,
      claimed: "A team already runs this business. Ask its admin to invite you under Team, or add a business.",
      suspended: "This business has been suspended and can't be added.",
      notFound: "We couldn't find this business. Choose again.",
      alreadyBound: "This account already belongs to another business.",
    },
    mail: {
      subject: (code) => `Your 找工 sign-in code: ${code}`,
      body: (code, minutes) =>
        `Your 找工 sign-in code is ${code}. It works for ${minutes} minutes.\n\nIf you didn't try to sign in, you can ignore this email: no one can sign in to your account without the code.`,
    },
  },
};
