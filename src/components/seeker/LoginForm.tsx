"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { isValidCode, isValidEmail, normalizeEmail } from "@/components/seeker/session";
import { signIn, signOut, useHydrated, useSession } from "@/components/seeker/session-client";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-brand aria-invalid:border-danger";
const primaryClass = "w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white";

/** Demo email sign-up / sign-in (the same step): any address, then any six-digit code. Goes to `next` afterwards. */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useSession();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!hydrated) return <div className="h-40 animate-pulse rounded-xl border border-border bg-surface" aria-hidden="true" />;

  if (session) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <p className="text-sm">
          你已登录：<span className="font-medium">{session.email}</span>
        </p>
        <button type="button" onClick={() => router.replace(next)} className={primaryClass}>
          继续
        </button>
        <button type="button" onClick={signOut} className="w-full py-1 text-sm text-muted underline underline-offset-2">
          退出登录
        </button>
      </div>
    );
  }

  function submitEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = normalizeEmail(String(new FormData(e.currentTarget).get("email") ?? ""));
    if (!isValidEmail(value)) return setError("请输入正确的邮箱地址");
    setEmail(value);
    setError(null);
    setStep("code");
  }

  function submitCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "");
    if (!isValidCode(code)) return setError("请输入 6 位数字验证码");
    signIn(email);
    router.replace(next);
  }

  return step === "email" ? (
    <form onSubmit={submitEmail} noValidate className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">邮箱</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={email}
          placeholder="you@example.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
          className={inputClass}
        />
      </label>
      {error && <ErrorText>{error}</ErrorText>}
      <button type="submit" className={primaryClass}>
        获取验证码
      </button>
      <p className="text-xs text-muted">新邮箱会自动注册。邮箱只用来登录，不会显示给雇主。</p>
    </form>
  ) : (
    <form onSubmit={submitCode} noValidate className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <p className="text-sm">
        验证码已发送到 <span className="font-medium">{email}</span>
      </p>
      <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand">演示版不会真的发送邮件，输入任意 6 位数字即可注册或登录。</p>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">验证码</span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="6 位数字"
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
          className={`${inputClass} tracking-[0.3em]`}
        />
      </label>
      {error && <ErrorText>{error}</ErrorText>}
      <button type="submit" className={primaryClass}>
        登录
      </button>
      <button
        type="button"
        onClick={() => {
          setStep("email");
          setError(null);
        }}
        className="w-full py-1 text-sm text-muted underline underline-offset-2"
      >
        换个邮箱
      </button>
    </form>
  );
}

function ErrorText({ children }: { children: string }) {
  return (
    <p id="login-error" role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}
