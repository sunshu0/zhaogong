// The English side of employer-team.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { employerTeamMessages } from "@/i18n/messages/employer-team";

export const employerTeamEn: Messages<(typeof employerTeamMessages)["zh"]> = {
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
    intro: (max) =>
      `'s team, up to ${max} people. Members can post jobs, manage jobs, handle applications and reply in chats. Admins can also manage the team and apply for business verification.`,
    left: "You have left the team.",
    nameSaved: "Your name is saved.",
    changedBefore: "",
    roleChanged: (role) => `'s role is now: ${role}.`,
    removed: " has been removed from the team.",
    invited: (email) => `${email} has been invited. They join once they accept under Me.`,
    inviteCancelled: "The invitation has been withdrawn.",
    membersHeading: (n) => `Members (${n})`,

    myName: {
      heading: "My name",
      hintBefore: "Your team sees who sent each reply in a chat, for example “",
      hintAfter: "”.",
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
    invitedBy: (role) =>
      ` has invited you to join their team. Your role: ${role}. Once you join you can switch to the employer role to post jobs, handle applications and reply in chats for this business.`,
    nameLabel: (max) => `Your name in the team (for example “Mr Wang”, up to ${max} characters)`,
    accept: "Accept and join",
    decline: "Decline",
    declinedBefore: "Declined the invitation from ",
    declinedAfter: ".",
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
};
