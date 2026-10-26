"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useIdentitySwitch } from "@/components/account/identity-switch";
import { adminEntry } from "@/components/account/moderator-entry";
import { employerSignUpHref, postJobHref } from "@/components/seeker/identity";
import { setIdentity, signOut, syncWithServer, useHydrated, useSession } from "@/components/seeker/session-client";
import { ACCOUNT_DATA_PATH, navRole, showsPostJob } from "@/components/ui/nav";
import { toast } from "@/components/ui/Toast";
import { useLang, useMessages } from "@/i18n/client";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";
import { contentLang } from "@/i18n/lang";

/** Once per page load, make the browser's copy of the session match the server's (A12-1: the cookie is the truth). */
function useAccountSync() {
  useEffect(() => syncWithServer(), []);
}

/**
 * Header: 登录 / 注册, or the account menu named after the active identity. On phones it is only the identity
 * switch (the rest is on 我的); from 768 px it also lists the workspace pages and 退出登录.
 */
export function AccountMenu() {
  const lang = useLang();
  const t = useMessages(seekerMeMessages).accountMenu;
  const hydrated = useHydrated();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const { employer, toEmployer, toSeeker, notice, clearNotice } = useIdentitySwitch();
  useAccountSync();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Keep a real link in the server shell so a no-JavaScript browser can still sign in. On phones, signing in is
  // 我的 in the bottom bar.
  if (!hydrated || !session) {
    return (
      <Link href="/login" className="hidden min-h-11 items-center px-1 hover:text-brand md:inline-flex">
        {t.signIn}
      </Link>
    );
  }

  const isEmployer = session.activeRole === "employer";
  // ADR 0043: a staff account is only its staff role, with 审核后台 and 退出登录.
  const staff = session.staff;
  const label = staff
    ? t[staff]
    : isEmployer && session.employerName
      ? `${t.employer} · ${session.employerName}`
      : t.seeker;
  const item = "block w-full rounded-md px-2 py-2 text-left text-body hover:bg-background";
  const pageItem = `${item} hidden md:block`;
  const close = () => setOpen(false);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => {
          clearNotice();
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={t.label(label)}
        className="flex min-h-11 max-w-[9rem] items-center gap-1 px-1 hover:text-brand md:max-w-[14rem]"
      >
        <span className="truncate">
          <span className="md:hidden">{staff ? t[staff] : isEmployer ? t.employer : t.seeker}</span>
          <span lang={contentLang(session.employerName)} className="hidden md:inline">
            {label}
          </span>
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {notice && (
        <p
          role="status"
          className="absolute top-full right-0 z-30 mt-2 w-56 rounded-lg bg-warn-soft px-3 py-2 text-meta text-warn"
        >
          {notice}
        </p>
      )}
      {open && (
        <div
          id="account-menu"
          className="absolute top-full right-0 z-30 mt-2 w-60 rounded-xl border border-border bg-surface p-2 shadow-lg"
        >
          <p className="truncate px-2 pt-1 text-meta text-muted">{session.email}</p>
          <p className="px-2 pb-2 text-meta">
            {t.current}
            <span className="font-medium">{label}</span>
          </p>
          <div className="border-t border-border pt-1">
            {staff ? (
              <Link href={adminEntry(lang).href} className={`${item} font-medium text-brand`} onClick={close}>
                {adminEntry(lang).label}
              </Link>
            ) : (
              <>
                <Link href="/workspace" className={`${pageItem} font-medium text-brand`} onClick={close}>
                  {t.workspace}
                </Link>
                <Link href="/notifications" className={pageItem} onClick={close}>
                  {t.notifications}
                </Link>
                <Link href="/profile" className={pageItem} onClick={close}>
                  {isEmployer ? t.businessPage : t.profile}
                </Link>
                {!isEmployer && (
                  <Link href="/me" className={pageItem} onClick={close}>
                    {t.history}
                  </Link>
                )}
                <Link href={ACCOUNT_DATA_PATH} className={pageItem} onClick={close}>
                  {t.data}
                </Link>
                {employer ? (
                  <button
                    type="button"
                    className={item}
                    onClick={() => {
                      close();
                      if (isEmployer) toSeeker();
                      else void toEmployer();
                    }}
                  >
                    {isEmployer ? t.toSeeker : t.toEmployer(employer.name)}
                  </button>
                ) : (
                  <Link href={employerSignUpHref()} className={item} onClick={close}>
                    {t.setUpHiring}
                  </Link>
                )}
              </>
            )}
            <button
              type="button"
              className={pageItem}
              onClick={async () => {
                close();
                if (await signOut()) router.push("/jobs");
                else toast(t.signOutFailed, 8000);
              }}
            >
              {t.signOut}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 发布招聘 (header) and the landing page's employer links. With an employer identity it switches to it and goes
 * to posting; otherwise it goes through employer sign-up (the email step signed out, the business step signed in).
 */
export function PostJobLink({ className = "", children }: { className?: string; children?: ReactNode }) {
  const t = useMessages(seekerMeMessages).accountMenu;
  const hydrated = useHydrated();
  const session = useSession();
  const current = hydrated ? session : null;
  return (
    <Link
      href={postJobHref(current)}
      onClick={() => {
        if (current?.employerId && current.employerName && current.activeRole !== "employer") {
          setIdentity({ activeRole: "employer", employer: { id: current.employerId, name: current.employerName } });
        }
      }}
      className={className}
    >
      {children ?? t.postJob}
    </Link>
  );
}

/** The header's 发布招聘 button: for visitors (through employer sign-up) and employers; job seekers do not get it. */
export function HeaderPostJob() {
  const hydrated = useHydrated();
  const session = useSession();
  const role = navRole(hydrated ? session : null);
  if (!showsPostJob(role)) return null;
  // Employers post from the bottom bar on phones, so there it is only the visitors' way in.
  return (
    <PostJobLink
      className={`${role === "employer" ? "hidden md:inline-flex" : "inline-flex"} pressable min-h-11 items-center rounded-control bg-brand px-3.5 font-semibold text-white hover:bg-brand-strong active:bg-brand-strong`}
    />
  );
}
