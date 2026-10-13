"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { accountStatus } from "@/app/login/actions";
import { employerSignUpHref, identityLabel, postJobHref, reconcileIdentity } from "@/components/seeker/identity";
import { setIdentity, signOut, useHydrated, useSession } from "@/components/seeker/session-client";
import type { DemoSession } from "@/components/seeker/session";

/** Once per page load, make the browser's copy of the identity match the account on the server. */
function useAccountSync(session: DemoSession | null) {
  const synced = useRef<string | null>(null);
  const email = session?.email;
  const wanted = session?.activeRole;
  useEffect(() => {
    if (!email || !wanted || synced.current === email) return;
    synced.current = email;
    accountStatus(email).then((status) => {
      if (!status) return;
      const identity = reconcileIdentity(wanted, status);
      setIdentity(identity);
    });
  }, [email, wanted]);
}

/** Header: 登录 / 注册, or the account menu with the active identity and switching. */
export function AccountMenu() {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useAccountSync(session);

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

  // Keep a real link in the server shell so a no-JavaScript browser can still sign in.
  // Once hydrated, this is replaced by the session-aware menu when a session exists.
  if (!hydrated) {
    return (
      <Link href="/login" className="inline-flex min-h-11 items-center px-1 hover:text-brand">
        登录 / 注册
      </Link>
    );
  }
  if (!session) {
    return (
      <Link href="/login" className="inline-flex min-h-11 items-center px-1 hover:text-brand">
        登录 / 注册
      </Link>
    );
  }

  const label = identityLabel(session);
  const employer =
    session.employerId && session.employerName ? { id: session.employerId, name: session.employerName } : null;

  async function switchToEmployer() {
    if (!session || !employer) return;
    // The business comes from the server, not from this browser's copy.
    const status = await accountStatus(session.email);
    const identity = reconcileIdentity("employer", status ?? {});
    setIdentity(identity);
    setOpen(false);
    if (identity.activeRole === "employer") router.push("/workspace");
    else setNotice("这个账号的雇主身份已不可用，请重新开通。");
  }

  function switchToSeeker() {
    if (!employer) return;
    setIdentity({ activeRole: "seeker", employer });
    setOpen(false);
    router.push("/workspace");
  }

  const item = "block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-background";

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => {
          setNotice(null);
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={`账号菜单，当前身份：${label}`}
        className="flex min-h-11 max-w-[9rem] items-center gap-1 px-1 hover:text-brand sm:max-w-[14rem]"
      >
        <span className="truncate">
          <span className="sm:hidden">{session.activeRole === "employer" ? "雇主" : "求职者"}</span>
          <span className="hidden sm:inline">{label}</span>
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {notice && (
        <p
          role="status"
          className="absolute top-full right-0 z-30 mt-2 w-56 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn"
        >
          {notice}
        </p>
      )}
      {open && (
        <div
          id="account-menu"
          className="absolute top-full right-0 z-30 mt-2 w-60 rounded-xl border border-border bg-surface p-2 shadow-lg"
        >
          <p className="truncate px-2 pt-1 text-xs text-muted">{session.email}</p>
          <p className="px-2 pb-2 text-xs">
            当前身份：<span className="font-medium">{label}</span>
          </p>
          <div className="border-t border-border pt-1">
            <Link href="/workspace" className={`${item} font-medium text-brand`} onClick={() => setOpen(false)}>
              进入工作台
            </Link>
            <Link href="/me" className={item} onClick={() => setOpen(false)}>
              我的
            </Link>
            {employer ? (
              session.activeRole === "employer" ? (
                <button type="button" className={item} onClick={switchToSeeker}>
                  切换为求职者
                </button>
              ) : (
                <button type="button" className={item} onClick={switchToEmployer}>
                  切换为雇主（{employer.name}）
                </button>
              )
            ) : (
              <Link href={employerSignUpHref()} className={item} onClick={() => setOpen(false)}>
                开通雇主身份
              </Link>
            )}
            <button
              type="button"
              className={item}
              onClick={() => {
                signOut();
                setOpen(false);
                router.push("/jobs");
              }}
            >
              退出登录
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
export function PostJobLink({ className = "", children = "发布招聘" }: { className?: string; children?: ReactNode }) {
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
      {children}
    </Link>
  );
}
