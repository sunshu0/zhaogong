"use client";
import { useId, useState, type FormEvent } from "react";
import type { Employer } from "@/lib/types";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";
import { isValidCode, isValidEmail, normalizeEmail } from "@/components/seeker/session";
import { useSession } from "@/components/seeker/session-client";
import { linkEmployer, signInEmployer, signOutEmployer } from "@/components/employer/session";

export type DemoAccount = Pick<Employer, "id" | "name" | "verification">;

const input = "h-11 w-full rounded-lg border border-border bg-background px-3";
const primary = "h-11 w-full rounded-lg bg-brand font-medium text-white";

/**
 * Line A's demo sign-in (email, then any 6-digit code), then which demo business to post for.
 * Someone already signed in on the site only picks the business.
 */
export function SignInPanel({ accounts, intro }: { accounts: DemoAccount[]; intro?: string }) {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [employerId, setEmployerId] = useState(accounts[0]?.id ?? "");
  const [error, setError] = useState<string>();
  const id = useId();

  function sendCode(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail(normalizeEmail(email))) return setError("请输入正确的邮箱地址");
    setError(undefined);
    setCodeSent(true);
  }

  function finish(e: FormEvent) {
    e.preventDefault();
    if (session) return linkEmployer(session.email, employerId);
    if (!isValidCode(code)) return setError("请输入 6 位数字验证码");
    signInEmployer(email, employerId);
  }

  const picker = (
    <fieldset>
      <legend className="text-sm font-medium">演示账号：以哪家店的身份发布</legend>
      <div className="mt-2 space-y-2">
        {accounts.map((a) => (
          <label
            key={a.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 has-checked:border-brand has-checked:bg-brand-soft"
          >
            <input
              type="radio"
              name={`${id}-account`}
              value={a.id}
              checked={employerId === a.id}
              onChange={() => setEmployerId(a.id)}
              className="accent-brand"
            />
            <span className="text-sm">{a.name}</span>
            <VerificationBadge verification={a.verification} />
          </label>
        ))}
      </div>
    </fieldset>
  );

  if (session) {
    return (
      <form onSubmit={finish} className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <p className="text-sm">
          已登录 <span className="font-medium">{session.email}</span>
          <button type="button" onClick={signOutEmployer} className="ml-2 text-muted underline">
            换个邮箱
          </button>
        </p>
        {picker}
        <button type="submit" className={primary}>
          确定
        </button>
      </form>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">{intro ?? "用邮箱登录，不用设密码。"}</p>
      {!codeSent ? (
        <form onSubmit={sendCode} className="mt-3 space-y-3" noValidate>
          <label htmlFor={`${id}-email`} className="block text-sm font-medium">
            邮箱
          </label>
          <input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className={input}
          />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button type="submit" className={primary}>
            获取验证码
          </button>
        </form>
      ) : (
        <form onSubmit={finish} className="mt-3 space-y-3" noValidate>
          <p className="text-sm">
            验证码已发到 <span className="font-medium">{normalizeEmail(email)}</span>
            <button type="button" onClick={() => setCodeSent(false)} className="ml-2 text-brand underline">
              改邮箱
            </button>
          </p>
          <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand">演示版不会真的发送邮件，输入任意 6 位数字即可登录。</p>
          <label htmlFor={`${id}-code`} className="block text-sm font-medium">
            验证码
          </label>
          <input
            id={`${id}-code`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={`${input} tracking-[0.3em]`}
          />
          {picker}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button type="submit" className={primary}>
            登录
          </button>
        </form>
      )}
    </div>
  );
}
