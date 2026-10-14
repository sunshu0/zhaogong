"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useIdentitySwitch } from "@/components/account/identity-switch";
import { UnreadBadge } from "@/components/seeker/ChatEntry";
import { useNotifications, useProfile } from "@/components/seeker/hub-client";
import { employerSignUpHref } from "@/components/seeker/identity";
import { AvatarImage } from "@/components/seeker/ProfileAvatar";
import { signOut, useSession } from "@/components/seeker/session-client";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";

type Row = { href: string; label: string; hint?: string; badge?: number };

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

  const rows: Row[] = [
    { href: "/workspace", label: "总览", hint: "要处理的事" },
    { href: "/notifications", label: "通知", badge: unread },
    isEmployer
      ? { href: "/profile", label: "企业主页", hint: "企业介绍和招聘联系人" }
      : { href: "/profile", label: "我的主页", hint: "雇主看到的资料和简历" },
    isEmployer
      ? { href: "/employer/candidates", label: "推荐人才" }
      : { href: "/me", label: "浏览与举报", hint: "看过的职位和举报记录" },
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
        <ul>
          {rows.map((row) => (
            <li key={row.href} className="border-b border-border last:border-b-0">
              <Link href={row.href} className="flex min-h-14 items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-subtitle">{row.label}</span>
                  {row.hint && <span className="block text-meta text-muted">{row.hint}</span>}
                </span>
                {row.badge ? <UnreadBadge count={row.badge} /> : null}
                <ChevronRight aria-hidden="true" className="size-4 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
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
