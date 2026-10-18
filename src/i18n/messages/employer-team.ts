// Round 20 (ADR 0023): 团队. Covers src/components/employer/TeamPage.tsx, src/components/employer/TeamInvites.tsx,
// the wording and refusal texts in src/components/employer/team.ts, the error texts in
// src/app/[lang]/employer/team-actions.ts, the notifications in src/app/[lang]/employer/team-notifications.ts, and the title and
// description of src/app/[lang]/employer/team/page.tsx.
import type { Dictionary } from "@/i18n/messages";

const employerTeamZh = {
  /** src/app/[lang]/employer/team/page.tsx */
  teamRoute: {
    metaTitle: "团队",
    metaDescription: "邀请同事一起管理企业的职位、申请和聊天，分管理员和成员。",
  },

  /** src/components/employer/team.ts */
  team: {
    roleLabel: { admin: "管理员", member: "成员" },
    nameRequired: "请填写称呼，例如「王经理」。",
    nameTooLong: (max: number) => `称呼最多 ${max} 个字。`,
    nameNoContact: "称呼里不要写邮箱或电话。",
    /** How the business side signs a chat: the shop, then who replied. */
    signature: (businessName: string, teamName: string) => `${businessName} · ${teamName}`,
    refusal: {
      not_member: "你已经不在这家企业的团队里了。",
      not_admin: "只有管理员能管理团队。",
      no_such_member: "这个人已经不在团队里了。",
      last_admin: "团队里至少要有一位管理员：先把另一位成员设为管理员。",
    },
  },

  /** src/components/employer/TeamPage.tsx */
  teamPage: {
    loading: "正在读取团队",
    noEmployerRole: "需要先开通雇主身份。",
    networkError: "网络有问题，请稍后再试。",
    title: "团队",
    /** After the business's name, which leads the line in its own lang. */
    intro: (max: number) =>
      ` 的团队，最多 ${max} 人。成员可以发职位、管理职位、处理申请和回复聊天；管理员还能管理团队和申请企业验证。`,
    left: "你已退出团队。",
    nameSaved: "称呼已保存。",
    /** Around the person's name, which is their own words (marked separately). */
    changedBefore: "已把 ",
    roleChanged: (role: string) => ` 设为${role}。`,
    removed: " 移出团队。",
    invited: (email: string) => `已邀请 ${email}，对方在「我的」里接受后加入。`,
    inviteCancelled: "邀请已撤回。",
    membersHeading: (n: number) => `成员（${n}）`,

    myName: {
      heading: "我的称呼",
      /** Around the example signature, which is the business's and the person's own names. */
      hintBefore: "团队里的人在聊天里能看到每条回复是谁发的，例如「",
      hintAfter: "」。",
      exampleName: "王经理",
      nameLabel: (max: number) => `称呼（最多 ${max} 个字）`,
      save: "保存称呼",
    },

    member: {
      noName: "（还没有称呼）",
      rowLabel: (name: string, role: string) => `${name}，${role}`,
      you: "（你）",
      confirmLeave: "确认退出",
      confirmRemove: "确认移除",
      cancel: "取消",
      makeMember: "改为成员",
      makeAdmin: "设为管理员",
      leave: "退出团队",
      remove: "移出团队",
    },

    invite: {
      heading: "邀请成员",
      hint: "对方要先用这个邮箱登录过找工，并且还没有自己的企业。对方在「我的」里接受后加入。",
      emailLabel: "对方的邮箱",
      roleLegend: "身份",
      send: "发送邀请",
      pendingHeading: "等对方回复",
      pendingRow: (email: string, role: string) => `${email} · ${role}`,
      expired: (days: number) => `已过期（${days} 天没回复，可以再邀请）`,
      cancel: "撤回邀请",
    },
  },

  /** src/components/employer/TeamInvites.tsx (团队邀请 on 我的) */
  teamInvites: {
    heading: "团队邀请",
    networkError: "网络有问题，请稍后再试。",
    cardLabel: (businessName: string) => `${businessName} 的邀请`,
    /** After the business's name, which leads the line in its own lang. */
    invitedBy: (role: string) =>
      ` 邀请你加入团队，做${role}。加入后可以切换到雇主身份，为这家店发职位、处理申请和回复聊天。`,
    nameLabel: (max: number) => `你在团队里的称呼（例如「王经理」，最多 ${max} 个字）`,
    accept: "接受并加入",
    decline: "婉拒",
    /** Around the business's name, which is its own words. */
    declinedBefore: "已婉拒「",
    declinedAfter: "」的邀请。",
  },

  /** src/app/[lang]/employer/team-actions.ts */
  teamActions: {
    noEmployerRole: "需要先开通雇主身份。",
    signIn: "请先登录。",
    badEmail: "请填写对方注册找工用的邮箱。",
    unknownChange: "看不懂这个操作。",
    inviteGone: "这条邀请已经回复或撤回了。",
    invite: {
      no_account: "这个邮箱还没有注册找工。请对方先用这个邮箱登录一次，再来邀请。",
      member: "这个人已经在团队里了。",
      has_business: "这个账号已经属于另一家企业，不能再加入。",
      pending: "已经邀请过这个人，等对方回复。",
      full: (max: number) => `团队最多 ${max} 人（包括还没回复的邀请）。`,
      too_many: (perDay: number) => `这家企业 24 小时内已经发了 ${perDay} 条邀请，明天再邀请。`,
    },
    answer: {
      gone: "这条邀请已经撤回或回复过了。",
      has_business: "你的账号已经属于一家企业，不能再加入别的企业。",
      full: (max: number) => `这个团队已经满 ${max} 人了。`,
      declined: "",
    },
  },

  /** src/app/[lang]/employer/team-notifications.ts */
  teamNotifications: {
    type: "团队",
    title: (businessName: string) => `${businessName} 邀请你加入团队`,
    detail: (role: string) => `加入后做${role}，用雇主身份为这家店发职位、回复聊天。在「我的」里接受或婉拒。`,
  },
};

export const employerTeamMessages: Dictionary<typeof employerTeamZh> = { key: "employerTeam", zh: employerTeamZh };
