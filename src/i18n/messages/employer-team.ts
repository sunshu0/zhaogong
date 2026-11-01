// Round 20 (ADR 0023): 团队. Covers src/components/employer/TeamPage.tsx, src/components/employer/TeamInvites.tsx,
// the wording and refusal texts in src/components/employer/team.ts, the error texts in
// src/app/[lang]/employer/team-actions.ts, the notifications in src/app/[lang]/employer/team-notifications.ts, the title and
// description of src/app/[lang]/employer/team/page.tsx, and the invitation links (#349, ADR 0028): TeamLinks.tsx and
// the join page src/app/[lang]/employer/team/join/[token]/page.tsx with TeamJoin.tsx.
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
      busy: "团队信息刚有变化，请再试一次。",
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
    setUpHiring: "开通雇主身份",
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

    /** src/components/employer/TeamLinks.tsx (#349) */
    link: {
      heading: "邀请链接",
      hint: (days: number) =>
        `把链接发到微信等地方。对方打开后用邮箱登录（没注册过的会自动注册），填好称呼就加入团队，身份是成员；要当管理员，加入后在这里设。链接 ${days} 天内有效，只能用一次。`,
      create: "生成邀请链接",
      createdHeading: "新的邀请链接",
      createdNote: "这条链接只显示这一次，请现在复制。丢了就撤销，再生成一条。",
      linkLabel: "邀请链接",
      copy: "复制链接",
      openHeading: "还没用掉的链接",
      openRow: (by: string, made: string, until: string) => `${by} 生成于 ${made} · 加入为成员 · ${until} 前有效`,
      expired: "已过期",
      revoke: "撤销链接",
      revoked: "链接已撤销。",
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
      full: (max: number) => `团队最多 ${max} 人（包括还没回复的邀请和还没用掉的链接）。`,
      too_many: (perDay: number) => `这家企业 24 小时内已经发了 ${perDay} 条邀请，明天再邀请。`,
    },
    link: {
      gone: "这条链接已经用过或撤销了。",
    },
    answer: {
      gone: "这条邀请已经撤回或回复过了。",
      has_business: "你的账号已经属于一家企业，不能再加入别的企业。",
      full: (max: number) => `这个团队已经满 ${max} 人了。`,
      declined: "",
    },
  },

  /** src/app/[lang]/employer/team/join/[token]/page.tsx and src/components/employer/TeamJoin.tsx (#349) */
  teamJoin: {
    metaTitle: "加入团队",
    title: "加入团队",
    loading: "正在读取邀请",
    /** After the business's name, which leads the line in its own lang. */
    invited: " 邀请你加入团队，身份是成员。加入后可以切换到雇主身份，为这家店发职位、处理申请和回复聊天。",
    signInHint: "先用邮箱登录。没注册过找工的，第一次登录就会自动注册。",
    signIn: "登录后加入",
    signedInAs: (email: string) => `你现在登录的是 ${email}。`,
    nameLabel: (max: number) => `你在团队里的称呼（例如「王经理」，最多 ${max} 个字）`,
    join: "加入团队",
    networkError: "网络有问题，请稍后再试。",
    goTeam: "去团队页",
    home: "回到找工首页",
    state: {
      invalid: "这条邀请链接不对：可能复制时少了几个字，或者被改过。请找发链接的人再发一次。",
      expired: (days: number) => `这条邀请链接已经过期（${days} 天内有效）。请找这家店的管理员再生成一条。`,
      used: "这条邀请链接已经用过了，每条只能用一次。请找这家店的管理员再生成一条。",
      revoked: "这条邀请链接已经被管理员撤销了。",
      banned: "这家店已被封禁，不能加入。",
      member: "你已经在这家店的团队里了。",
      has_business: "你的账号已经属于一家企业。要加入这家店，先在「团队」里退出原来的企业。",
      full: (max: number) => `这个团队已经满 ${max} 人了，请联系这家店的管理员。`,
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
