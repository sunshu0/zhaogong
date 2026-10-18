// Round 20 (ADR 0023): 团队. Covers src/components/employer/TeamPage.tsx, src/components/employer/TeamInvites.tsx,
// the wording and refusal texts in src/components/employer/team.ts, the error texts in
// src/app/employer/team-actions.ts, the notifications in src/app/employer/team-notifications.ts, and the title and
// description of src/app/employer/team/page.tsx.
import type { Dictionary } from "@/i18n/messages";

const employerTeamZh = {
  /** src/app/employer/team/page.tsx */
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
    intro: (businessName: string, max: number) =>
      `${businessName} 的团队，最多 ${max} 人。成员可以发职位、管理职位、处理申请和回复聊天；管理员还能管理团队和申请企业验证。`,
    left: "你已退出团队。",
    nameSaved: "称呼已保存。",
    roleChanged: (who: string, role: string) => `已把 ${who} 设为${role}。`,
    removed: (who: string) => `已把 ${who} 移出团队。`,
    invited: (email: string) => `已邀请 ${email}，对方在「我的」里接受后加入。`,
    inviteCancelled: "邀请已撤回。",
    membersHeading: (n: number) => `成员（${n}）`,

    myName: {
      heading: "我的称呼",
      hint: (example: string) => `团队里的人在聊天里能看到每条回复是谁发的，例如「${example}」。`,
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
    invitedBy: (businessName: string, role: string) =>
      `${businessName} 邀请你加入团队，做${role}。加入后可以切换到雇主身份，为这家店发职位、处理申请和回复聊天。`,
    nameLabel: (max: number) => `你在团队里的称呼（例如「王经理」，最多 ${max} 个字）`,
    accept: "接受并加入",
    decline: "婉拒",
  },

  /** src/app/employer/team-actions.ts */
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

  /** src/app/employer/team-notifications.ts */
  teamNotifications: {
    type: "团队",
    title: (businessName: string) => `${businessName} 邀请你加入团队`,
    detail: (role: string) => `加入后做${role}，用雇主身份为这家店发职位、回复聊天。在「我的」里接受或婉拒。`,
  },
};

export const employerTeamMessages: Dictionary<typeof employerTeamZh> = {
  zh: employerTeamZh,
  en: {
    teamRoute: {
      metaTitle: "Team",
      metaDescription:
        "Invite workmates to help manage the business's jobs, applications and chats, as admins or members.",
    },

    team: {
      roleLabel: { admin: "Admin", member: "Member" },
      nameRequired: "Enter a name, for example “Mr Wang”.",
      nameTooLong: (max) => `A name can be up to ${max} characters.`,
      nameNoContact: "Don't put an email address or a phone number in the name.",
      signature: (businessName, teamName) => `${businessName} · ${teamName}`,
      refusal: {
        not_member: "You're no longer in this business's team.",
        not_admin: "Only an admin can manage the team.",
        no_such_member: "This person is no longer in the team.",
        last_admin: "A team needs at least one admin. Make another member an admin first.",
      },
    },

    teamPage: {
      loading: "Loading the team",
      noEmployerRole: "Set up hiring first.",
      networkError: "Network problem. Try again shortly.",
      title: "Team",
      intro: (businessName, max) =>
        `${businessName}'s team, up to ${max} people. Members can post jobs, manage jobs, handle applications and reply in chats. Admins can also manage the team and apply for business verification.`,
      left: "You have left the team.",
      nameSaved: "Your name is saved.",
      roleChanged: (who, role) => `${who}'s role is now: ${role}.`,
      removed: (who) => `${who} has been removed from the team.`,
      invited: (email) => `${email} has been invited. They join once they accept under Me.`,
      inviteCancelled: "The invitation has been withdrawn.",
      membersHeading: (n) => `Members (${n})`,

      myName: {
        heading: "My name",
        hint: (example) => `Your team sees who sent each reply in a chat, for example “${example}”.`,
        exampleName: "Mr Wang",
        nameLabel: (max) => `Name (up to ${max} characters)`,
        save: "Save name",
      },

      member: {
        noName: "(no name yet)",
        rowLabel: (name, role) => `${name}, ${role}`,
        you: " (you)",
        confirmLeave: "Yes, leave",
        confirmRemove: "Yes, remove",
        cancel: "Cancel",
        makeMember: "Make a member",
        makeAdmin: "Make an admin",
        leave: "Leave the team",
        remove: "Remove from the team",
      },

      invite: {
        heading: "Invite someone",
        hint: "They need to have signed in to 找工 with this email, and not have a business of their own. They join once they accept under Me.",
        emailLabel: "Their email",
        roleLegend: "Role",
        send: "Send the invitation",
        pendingHeading: "Waiting for an answer",
        pendingRow: (email, role) => `${email} · ${role}`,
        expired: (days) => `Expired (no answer in ${days} days, so you can invite them again)`,
        cancel: "Withdraw the invitation",
      },
    },

    teamInvites: {
      heading: "Team invitations",
      networkError: "Network problem. Try again shortly.",
      cardLabel: (businessName) => `Invitation from ${businessName}`,
      invitedBy: (businessName, role) =>
        `${businessName} has invited you to join their team. Your role: ${role}. Once you join you can switch to the employer role to post jobs, handle applications and reply in chats for this business.`,
      nameLabel: (max) => `Your name in the team (for example “Mr Wang”, up to ${max} characters)`,
      accept: "Accept and join",
      decline: "Decline",
    },

    teamActions: {
      noEmployerRole: "Set up hiring first.",
      signIn: "Sign in first.",
      badEmail: "Enter the email they use for 找工.",
      unknownChange: "We don't understand this change.",
      inviteGone: "This invitation has already been answered or withdrawn.",
      invite: {
        no_account: "This email isn't registered with 找工. Ask them to sign in with it once, then invite them.",
        member: "This person is already in the team.",
        has_business: "This account already belongs to another business, so it can't join.",
        pending: "You've already invited this person. Waiting for their answer.",
        full: (max) => `A team can have up to ${max} people, counting invitations nobody has answered.`,
        too_many: (perDay) =>
          `This business has sent ${perDay} invitations in the last 24 hours. Invite someone tomorrow.`,
      },
      answer: {
        gone: "This invitation has already been withdrawn or answered.",
        has_business: "Your account already belongs to a business, so it can't join another one.",
        full: (max) => `This team is full at ${max} people.`,
        declined: "",
      },
    },

    teamNotifications: {
      type: "Team",
      title: (businessName) => `${businessName} has invited you to join their team`,
      detail: (role) =>
        `Your role would be: ${role}. With the employer role you can post jobs and reply in chats for this business. Accept or decline under Me.`,
    },
  },
};
