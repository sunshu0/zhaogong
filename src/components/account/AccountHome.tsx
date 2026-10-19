"use client";

import { useRouter } from "next/navigation";
import { useIdentitySwitch } from "@/components/account/identity-switch";
import { ADMIN_HREF, useCanModerate } from "@/components/account/moderator-entry";
import { useNotifications, useProfile } from "@/components/seeker/hub-client";
import { employerSignUpHref } from "@/components/seeker/identity";
import { ALERTS_PATH } from "@/components/seeker/job-alerts";
import { AvatarImage } from "@/components/seeker/ProfileAvatar";
import { signOut, useSession } from "@/components/seeker/session-client";
import { Button, ButtonLink } from "@/components/ui/Button";
import { LinkList, type LinkListItem } from "@/components/ui/LinkList";
import { Section } from "@/components/ui/Section";
import { TeamInvites } from "@/components/employer/TeamInvites";
import { ACCOUNT_DATA_PATH } from "@/components/ui/nav";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { toast } from "@/components/ui/Toast";
import { useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { accountMessages } from "@/i18n/messages/account";

/**
 * 我的 (/account): who you are, switching identity, and every page that is not in the bottom bar. Round 19: cards
 * (Section look="app") whose rows darken while pressed.
 */
export function AccountHome() {
  const router = useRouter();
  const session = useSession();
  const { profile } = useProfile();
  const { unread } = useNotifications();
  const { employer, toEmployer, toSeeker, notice } = useIdentitySwitch();
  const moderator = useCanModerate();
  const t = useMessages(accountMessages);
  if (!session) return null;
  const isEmployer = session.activeRole === "employer";
  const name = (isEmployer ? session.employerName : profile.name) || session.email;

  const rows: LinkListItem[] = [
    { href: "/workspace", label: t.rows.workspace, detail: t.rows.workspaceDetail },
    { href: "/notifications", label: t.rows.notifications, badge: unread },
    isEmployer
      ? { href: "/profile", label: t.rows.businessPage, detail: t.rows.businessPageDetail }
      : { href: "/profile", label: t.rows.profile, detail: t.rows.profileDetail },
    ...(isEmployer
      ? [
          { href: "/employer/candidates", label: t.rows.candidates },
          { href: "/employer/verify", label: t.rows.verify, detail: t.rows.verifyDetail },
          { href: "/employer/team", label: t.rows.team, detail: t.rows.teamDetail },
        ]
      : [
          { href: "/me/saved", label: t.rows.saved, detail: t.rows.savedDetail },
          { href: ALERTS_PATH, label: t.rows.alerts, detail: t.rows.alertsDetail },
          { href: "/me", label: t.rows.history, detail: t.rows.historyDetail },
        ]),
    ...(moderator ? [{ href: ADMIN_HREF, label: t.rows.admin, detail: t.rows.adminDetail }] : []),
    { href: ACCOUNT_DATA_PATH, label: t.rows.data, detail: t.rows.dataDetail },
  ];

  return (
    <div className="space-y-section">
      <h1 className="sr-only">{t.title}</h1>
      <Section look="app">
        <div className="flex items-center gap-3 py-group">
          <AvatarImage avatar={profile.avatar} fallback={name} large />
          <div className="min-w-0">
            <p lang={contentLang(name)} className="break-words text-title font-semibold">
              {name}
            </p>
            <p className="break-all text-meta text-muted">{session.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 py-group">
          <p className="text-body">
            {t.role.current}
            <span className="font-medium">{isEmployer ? t.role.employer : t.role.seeker}</span>
          </p>
          {employer ? (
            <Button variant="secondary" onClick={isEmployer ? toSeeker : () => void toEmployer()}>
              {isEmployer ? t.role.toSeeker : t.role.toEmployer(employer.name)}
            </Button>
          ) : (
            <ButtonLink variant="secondary" href={employerSignUpHref()}>
              {t.role.setUpHiring}
            </ButtonLink>
          )}
        </div>
        {notice && (
          <p role="status" className="pb-group text-meta text-warn">
            {notice}
          </p>
        )}
      </Section>
      {!employer && <TeamInvites email={session.email} />}
      <Section look="app">
        <LinkList items={rows} />
      </Section>
      <Section look="app">
        <div className="py-group">
          <LangSwitch look="row" />
        </div>
      </Section>
      <Section look="app" className="overflow-hidden">
        <button
          type="button"
          className="pressable-row -mx-4 flex min-h-14 w-[calc(100%_+_2rem)] items-center justify-center text-subtitle font-medium text-danger hover:bg-danger-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-danger sm:-mx-5 sm:w-[calc(100%_+_2.5rem)]"
          onClick={async () => {
            if (await signOut()) router.push("/jobs");
            else toast(t.signOutFailed, 8000);
          }}
        >
          {t.signOut}
        </button>
      </Section>
    </div>
  );
}
