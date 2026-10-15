"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { accountStatus, openEmployerForAccount, signInAccount, type AccountStatus } from "@/app/login/actions";
import { COUNTRIES } from "@/config/countries";
import { VERIFICATION_LABELS } from "@/i18n/labels";
import type { EmployerVerification } from "@/lib/types";
import { defaultBusinessChoice, openErrorMessage, reconcileIdentity } from "@/components/seeker/identity";
import { isValidCode, isValidEmail, normalizeEmail, safeNext, type ActiveRole } from "@/components/seeker/session";
import { setIdentity, signOut, startSession, useHydrated, useSession } from "@/components/seeker/session-client";

export interface DemoBusiness {
  id: string;
  name: string;
  regionName: string;
  verification: EmployerVerification;
  /** Another account has bound it already (the demo data is shared by everyone online). */
  claimed: boolean;
}

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-brand aria-invalid:border-danger";
const primaryClass = "w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60";
const linkButtonClass = "w-full py-1 text-sm text-muted underline underline-offset-2";

const ROLE_OPTIONS: { role: ActiveRole; title: string; text: string }[] = [
  { role: "seeker", title: "我要找工作", text: "浏览职位，和雇主在线沟通、交换联系方式" },
  { role: "employer", title: "我要招人", text: "开通雇主身份，选择或新建你的企业，然后发布招聘" },
];

/**
 * 注册或登录 (the email code does both). Job seekers: email → code → `next`. Employers: email → code → their
 * business (one of the demo businesses or a new one) → `next`, default /employer/post. A signed-in job seeker
 * who comes here as an employer goes straight to the business step.
 */
export function LoginForm({
  initialRole,
  nextParam,
  businesses,
}: {
  initialRole: ActiveRole;
  /** The raw ?next=; checked with safeNext. */
  nextParam?: string;
  businesses: DemoBusiness[];
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useSession();
  const [role, setRole] = useState<ActiveRole>(initialRole);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Employer route, signed in: the server says whether the account already has a business.
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
  const next = safeNext(nextParam, role === "employer" ? "/employer/post" : "/jobs");

  // Next keeps visited pages alive (hidden) for back navigation. A sign-in should start fresh on every visit,
  // so put the form back to its first step when the page is hidden.
  const firstRole = useRef(initialRole);
  useLayoutEffect(() => {
    const role0 = firstRole.current;
    return () => {
      setRole(role0);
      setStep("email");
      setEmail("");
      setError(null);
      setCheckedFor(null);
    };
  }, []);

  const signedInEmail = session?.email;
  useEffect(() => {
    if (role !== "employer" || !signedInEmail || checkedFor === signedInEmail) return;
    let cancelled = false;
    accountStatus(signedInEmail).then((status) => {
      if (cancelled) return;
      if (status?.employer) {
        setIdentity(reconcileIdentity("employer", status));
        router.replace(next);
      } else {
        setIdentity({ activeRole: "seeker" });
        setCheckedFor(signedInEmail);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [role, signedInEmail, checkedFor, next, router]);

  if (!hydrated) return <Placeholder />;

  if (session && role === "employer") {
    if (checkedFor !== session.email) return <p className="text-sm text-muted">正在核对你的账号…</p>;
    return (
      <BusinessStep
        email={session.email}
        businesses={businesses}
        onDone={(employer) => {
          setIdentity({ activeRole: "employer", employer });
          router.replace(next);
        }}
      />
    );
  }

  if (session) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <p className="text-sm">
          你已登录：<span className="font-medium">{session.email}</span>
        </p>
        <button type="button" onClick={() => router.replace(next)} className={primaryClass}>
          继续
        </button>
        {!session.employerId && (
          <button type="button" onClick={() => setRole("employer")} className={linkButtonClass}>
            开通雇主身份
          </button>
        )}
        <button type="button" onClick={signOut} className={linkButtonClass}>
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
    setError(null);
    startTransition(async () => {
      const result = await signInAccount(email, code).catch(() => null);
      if (!result) return setError("网络有问题，请稍后再试");
      if (!result.ok) return setError(result.error);
      finishSignIn(result.account);
    });
  }

  function finishSignIn(account: AccountStatus) {
    if (role === "employer" && !account.employer) {
      // Signed in; the business step comes next.
      startSession(account.email, { activeRole: "seeker" });
      setCheckedFor(account.email);
      return;
    }
    startSession(account.email, reconcileIdentity(role, account));
    router.replace(next);
  }

  return step === "email" ? (
    <form onSubmit={submitEmail} noValidate className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">你想做什么？</legend>
        <div className="grid gap-2">
          {ROLE_OPTIONS.map((option) => (
            <label
              key={option.role}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-checked:border-brand has-checked:bg-brand-soft"
            >
              <input
                type="radio"
                name="role"
                value={option.role}
                checked={role === option.role}
                onChange={() => setRole(option.role)}
                className="mt-1 size-4 accent-brand"
              />
              <span>
                <span className="block text-sm font-medium">{option.title}</span>
                <span className="block text-xs text-muted">{option.text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
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
      <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand">
        演示版不会真的发送邮件，输入任意 6 位数字即可注册或登录。
      </p>
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
      <button type="submit" disabled={pending} className={primaryClass}>
        登录
      </button>
      <button
        type="button"
        onClick={() => {
          setStep("email");
          setError(null);
        }}
        className={linkButtonClass}
      >
        换个邮箱
      </button>
    </form>
  );
}

/** The employer identity's business: one of the demo businesses, or a new one (name + region). */
function BusinessStep({
  email,
  businesses,
  onDone,
}: {
  email: string;
  businesses: DemoBusiness[];
  onDone: (employer: { id: string; name: string }) => void;
}) {
  // Shops the server refused as taken since this page loaded (someone bound one in the meantime).
  const [takenHere, setTakenHere] = useState<readonly string[]>([]);
  const shops = businesses.map((b) => (takenHere.includes(b.id) ? { ...b, claimed: true } : b));
  const [choice, setChoice] = useState<string>(() => defaultBusinessChoice(businesses));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const regions = COUNTRIES.NZ.regions;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const payload =
      choice === "new"
        ? { kind: "new", name: String(data.get("name") ?? ""), regionId: String(data.get("regionId") ?? "") }
        : { kind: "existing", employerId: choice };
    setError(null);
    startTransition(async () => {
      const result = await openEmployerForAccount(email, payload).catch(() => null);
      if (!result) return setError("网络有问题，请稍后再试");
      if (!result.ok) {
        if (choice !== "new" && result.error === openErrorMessage("taken")) {
          const taken = [...takenHere, choice];
          setTakenHere(taken);
          setChoice(defaultBusinessChoice(shops.map((b) => ({ ...b, claimed: b.claimed || taken.includes(b.id) }))));
        }
        return setError(result.error);
      }
      onDone(result.employer);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <div>
        <h2 className="font-medium">开通雇主身份</h2>
        <p className="mt-1 text-xs text-muted">
          已登录：{email}。选择你的企业，发布的职位会显示这家企业。演示版可以选下面的演示店，或新建企业。
        </p>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">你的企业</legend>
        <div className="grid gap-2">
          {shops.map((b) => (
            <Choice key={b.id} value={b.id} current={choice} onPick={setChoice} disabled={b.claimed}>
              <span className="block text-sm font-medium">{b.name}</span>
              <span className="block text-xs text-muted">
                {b.regionName} · {VERIFICATION_LABELS[b.verification].zh}
                {b.claimed && " · 已被绑定"}
              </span>
            </Choice>
          ))}
          <Choice value="new" current={choice} onPick={setChoice}>
            <span className="block text-sm font-medium">新建企业</span>
            <span className="block text-xs text-muted">填写店名和地区；企业验证可以以后再做</span>
          </Choice>
        </div>
      </fieldset>

      {choice === "new" && (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">店名</span>
            <input name="name" maxLength={40} autoComplete="organization" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">地区</span>
            <select name="regionId" defaultValue="" className={inputClass}>
              <option value="" disabled>
                请选择
              </option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nameZh}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {error && <ErrorText>{error}</ErrorText>}
      <button type="submit" disabled={pending} className={primaryClass}>
        {pending ? "正在开通…" : "开通并开始发布招聘"}
      </button>
    </form>
  );
}

function Choice({
  value,
  current,
  onPick,
  disabled = false,
  children,
}: {
  value: string;
  current: string;
  onPick: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-checked:border-brand has-checked:bg-brand-soft has-disabled:cursor-not-allowed has-disabled:bg-background">
      <input
        type="radio"
        name="business"
        value={value}
        checked={current === value}
        disabled={disabled}
        onChange={() => onPick(value)}
        className="mt-1 size-4 accent-brand"
      />
      <span>{children}</span>
    </label>
  );
}

function Placeholder() {
  return <div className="h-40 animate-pulse rounded-xl border border-border bg-surface" aria-hidden="true" />;
}

function ErrorText({ children }: { children: string }) {
  return (
    <p id="login-error" role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}
