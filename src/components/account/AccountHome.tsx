"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIdentitySwitch } from "@/components/account/identity-switch";
import { useNotifications, useProfile } from "@/components/seeker/hub-client";
import { employerSignUpHref } from "@/components/seeker/identity";
import { AvatarImage } from "@/components/seeker/ProfileAvatar";
import { signOut, useSession } from "@/components/seeker/session-client";
import { Button } from "@/components/ui/Button";
import { LinkList, type LinkListItem } from "@/components/ui/LinkList";
import { Section } from "@/components/ui/Section";

/** 我的 (/account): who you are, switching identity, and every page that is not in the bottom bar. */
export function AccountHome() {
  const router = useRouter();
  const session = useSession();
  const { profile } = useProfile();
  const { unread } = useNotifications();
  const { employer, toEmployer, toSeeker, notice } = useIdentitySwitch();
  if (!session) return null;
  const isEmployer = session.activeRole === "employer";
  const name = (isEmployer ? session.employerName : profile.name) || session.email;

  const rows: LinkListItem[] = [
    { href: "/workspace", label: "总览", detail: "要处理的事" },
    { href: "/notifications", label: "通知", badge: unread },
    isEmployer
      ? { href: "/profile", label: "企业主页", detail: "企业介绍和招聘联系人" }
      : { href: "/profile", label: "我的主页", detail: "雇主看到的资料和简历" },
    ...(isEmployer
      ? [{ href: "/employer/candidates", label: "推荐人才" }]
      : [
          { href: "/me/saved", label: "收藏和进度", detail: "收藏的职位和求职进度" },
          { href: "/me", label: "浏览与举报", detail: "看过的职位和举报记录" },
        ]),
  ];

  return (
    <div className="space-y-section">
      <h1 className="sr-only">我的</h1>
      <Section>
        <div className="flex items-center gap-3 py-group">
          <AvatarImage avatar={profile.avatar} fallback={name} large />
          <div className="min-w-0">
            <p className="truncate text-title font-semibold">{name}</p>
            <p className="truncate text-meta text-muted">{session.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 py-group">
          <p className="text-body">
            当前身份：<span className="font-medium">{isEmployer ? "雇主" : "求职者"}</span>
          </p>
          {employer ? (
            <Button variant="secondary" onClick={isEmployer ? toSeeker : () => void toEmployer()}>
              {isEmployer ? "切换为求职者" : `切换为雇主（${employer.name}）`}
            </Button>
          ) : (
            <Link href={employerSignUpHref()} className="text-body text-brand underline-offset-4 hover:underline">
              开通雇主身份
            </Link>
          )}
        </div>
        {notice && (
          <p role="status" className="pb-group text-meta text-warn">
            {notice}
          </p>
        )}
      </Section>
      <Section>
        <LinkList items={rows} />
      </Section>
      <Section>
        <div className="py-2">
          <button
            type="button"
            className="min-h-11 w-full text-body text-danger"
            onClick={() => {
              signOut();
              router.push("/jobs");
            }}
          >
            退出登录
          </button>
        </div>
      </Section>
    </div>
  );
}
