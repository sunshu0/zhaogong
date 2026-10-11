"use client";
import { useId, useState, type FormEvent } from "react";
import type { Employer } from "@/lib/types";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";
import { signInEmployer } from "@/components/employer/session";

export type DemoAccount = Pick<Employer, "id" | "name" | "verification">;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email + 6-digit code, then pick which demo business to post for. Any code works in the demo. */
export function SignInPanel({ accounts, intro, onSignedIn }: { accounts: DemoAccount[]; intro?: string; onSignedIn?: () => void }) {
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [employerId, setEmployerId] = useState(accounts[0]?.id ?? "");
  const [error, setError] = useState<string>();
  const id = useId();

  function sendCode(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) return setError("请输入正确的邮箱地址");
    setError(undefined);
    setCodeSent(true);
  }

  function signIn(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("请输入 6 位数字验证码");
    signInEmployer({ email: email.trim(), employerId });
    onSignedIn?.();
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
            className="h-11 w-full rounded-lg border border-border bg-background px-3"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" className="h-11 w-full rounded-lg bg-brand font-medium text-white">
            获取验证码
          </button>
        </form>
      ) : (
        <form onSubmit={signIn} className="mt-3 space-y-3" noValidate>
          <p className="text-sm">
            验证码已发到 <span className="font-medium">{email.trim()}</span>
            <button type="button" onClick={() => setCodeSent(false)} className="ml-2 text-brand underline">
              改邮箱
            </button>
          </p>
          <label htmlFor={`${id}-code`} className="block text-sm font-medium">
            验证码 <span className="font-normal text-muted">（演示：任意 6 位数字）</span>
          </label>
          <input
            id={`${id}-code`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 tracking-[0.3em]"
          />
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
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" className="h-11 w-full rounded-lg bg-brand font-medium text-white">
            登录
          </button>
        </form>
      )}
    </div>
  );
}
