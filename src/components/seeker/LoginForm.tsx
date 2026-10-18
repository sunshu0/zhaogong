"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  accountStatus,
  openEmployerForAccount,
  requestSignInCode,
  signInAccount,
  type AccountStatus,
} from "@/app/login/actions";
import { COUNTRIES } from "@/config/countries";
import { VERIFICATION_LABELS } from "@/i18n/labels";
import type { EmployerVerification } from "@/lib/types";
import {
  businessChoice,
  defaultBusinessChoice,
  openErrorMessage,
  reconcileIdentity,
} from "@/components/seeker/identity";
import { resendLabel, secondsLeft } from "@/components/seeker/code-resend";
import { emailTypoFix } from "@/components/seeker/email-typos";
import { isValidCode, isValidEmail, normalizeEmail, safeNext, type ActiveRole } from "@/components/seeker/session";
import { setIdentity, signOut, startSession, useHydrated, useSession } from "@/components/seeker/session-client";
import { Button } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { Radio } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { inputClass } from "@/components/ui/input-class";

export interface DemoBusiness {
  id: string;
  name: string;
  regionName: string;
  verification: EmployerVerification;
  /** Another account has bound it already (the demo data is shared by everyone online). */
  claimed: boolean;
}

// Round 19 (操作质感): each step is a card; the shared fields (inputClass), the main button 48px high.
const CARD = cardClass();
const labelClass = "mb-1.5 block text-body font-medium";
const linkButtonClass =
  "pressable min-h-11 w-full rounded-control text-body text-muted underline underline-offset-2 hover:text-foreground disabled:opacity-50";
/** The address a mistyped domain should have been (#185): a link-like button inside a sentence. */
const fixButtonClass =
  "pressable inline-flex min-h-11 items-center rounded-control font-medium break-all text-brand underline underline-offset-2 disabled:opacity-50";

const ROLE_OPTIONS: { role: ActiveRole; title: string; text: string }[] = [
  { role: "seeker", title: "我要找工作", text: "浏览职位，和雇主在线沟通、交换联系方式" },
  { role: "employer", title: "我要招人", text: "开通雇主身份，选择或新建你的企业，然后发布招聘" },
];

/**
 * 注册或登录 (the email code does both; A12-1: the code is checked and the session started on the server). Job seekers: email → code → `next`. Employers: email → code → their
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
  // Outside production there is no mail service: the server also prints the code to its log and sends it back here.
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Employer route, signed in: the server says whether the account already has a business.
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
  // #184: when another code may be asked for (the server's once-a-minute rule), counted down on 重新获取验证码.
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const resendLeft = secondsLeft(resendAt, now);
  const counting = resendLeft > 0;
  // #185: the email field as it was when it was last left, for the hint about a mistyped domain.
  const emailInput = useRef<HTMLInputElement>(null);
  const [leftEmail, setLeftEmail] = useState("");
  const typoFix = emailTypoFix(leftEmail);
  const sentTypoFix = emailTypoFix(email); // the code went to a mistyped address
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
      setDevCode(null);
      setError(null);
      setCheckedFor(null);
      setResendAt(0);
      setLeftEmail("");
    };
  }, []);

  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [counting]);

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
    if (checkedFor !== session.email) return <LoginFormSkeleton label="正在核对你的账号…" />;
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
      <div className={`space-y-3 ${CARD}`}>
        <p className="text-body">
          你已登录：<span className="font-medium break-all">{session.email}</span>
        </p>
        <Button size="lg" block onClick={() => router.replace(next)}>
          继续
        </Button>
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

  function waitBeforeResend(seconds: number) {
    const at = Date.now();
    setNow(at);
    setResendAt(at + seconds * 1000);
  }

  function sendCode(address: string) {
    setError(null);
    startTransition(async () => {
      const result = await requestSignInCode(address).catch(() => null);
      if (!result) return setError("网络有问题，请稍后再试");
      if (!result.ok) {
        // Asked too soon (another tab, say): count down from what the server says is left.
        if (result.retryAfterSec) waitBeforeResend(result.retryAfterSec);
        return setError(result.error);
      }
      waitBeforeResend(result.resendInSec);
      setEmail(address);
      setDevCode(result.devCode ?? null);
      setStep("code");
    });
  }

  function submitEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = normalizeEmail(String(new FormData(e.currentTarget).get("email") ?? ""));
    if (!isValidEmail(value)) return setError("请输入正确的邮箱地址");
    sendCode(value);
  }

  function submitCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "");
    if (!isValidCode(code)) return setError("请输入 6 位数字验证码");
    setError(null);
    startTransition(async () => {
      const result = await signInAccount(email, code, role).catch(() => null);
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
    <form onSubmit={submitEmail} noValidate className={`space-y-5 ${CARD}`}>
      <fieldset>
        <legend className={labelClass}>你想做什么？</legend>
        <div className="grid gap-2">
          {ROLE_OPTIONS.map((option) => (
            <ChoiceCard key={option.role}>
              <Radio
                name="role"
                value={option.role}
                checked={role === option.role}
                onChange={() => setRole(option.role)}
              >
                <ChoiceText title={option.title} text={option.text} />
              </Radio>
            </ChoiceCard>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className={labelClass}>邮箱</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={email}
          ref={emailInput}
          onBlur={(e) => setLeftEmail(e.currentTarget.value)}
          // Once the hint shows, it follows the typing, so it goes as soon as the domain is put right.
          onChange={(e) => {
            if (typoFix) setLeftEmail(e.currentTarget.value);
          }}
          placeholder="you@example.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
          className={inputClass({ tone: error ? "danger" : undefined })}
        />
      </label>
      {error && <ErrorText>{error}</ErrorText>}
      <Button type="submit" size="lg" block loading={pending}>
        {pending ? "正在发送…" : "获取验证码"}
      </Button>
      {/* Below the button, so a hint that appears as the field is left (tapping the button) does not move it. */}
      <p className="sr-only" aria-live="polite">
        {typoFix ? `邮箱是不是 ${typoFix}？` : ""}
      </p>
      {typoFix && (
        <p className="text-body">
          是不是{" "}
          <button
            type="button"
            aria-label={`改成 ${typoFix}`}
            onClick={() => {
              if (emailInput.current) emailInput.current.value = typoFix;
              setLeftEmail(typoFix);
            }}
            className={fixButtonClass}
          >
            {typoFix}
          </button>
          ？
        </p>
      )}
      <p className="text-meta text-muted">新邮箱会自动注册。邮箱只用来登录，不会显示给雇主。</p>
    </form>
  ) : (
    <form onSubmit={submitCode} noValidate className={`space-y-4 ${CARD}`}>
      <p className="text-body">
        验证码已发送到 <span className="font-medium break-all">{email}</span>
      </p>
      {sentTypoFix && (
        <p className="text-body">
          地址是不是拼错了？{" "}
          <button type="button" disabled={pending} onClick={() => sendCode(sentTypoFix)} className={fixButtonClass}>
            改用 {sentTypoFix}
          </button>
        </p>
      )}
      {devCode ? (
        <p className="rounded-control bg-brand-soft px-3 py-2 text-meta text-brand">
          开发环境没有接邮件服务，验证码打印在服务器日志里：
          <span data-testid="dev-sign-in-code" className="ml-1 font-mono text-body font-semibold tracking-widest">
            {devCode}
          </span>
        </p>
      ) : (
        <p className="text-meta text-muted">10 分钟内有效。没收到可以 1 分钟后重新获取。</p>
      )}
      <label className="block">
        <span className={labelClass}>验证码</span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="6 位数字"
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
          className={`${inputClass({ tone: error ? "danger" : undefined })} font-figure tracking-[0.4em]`}
        />
      </label>
      {error && <ErrorText>{error}</ErrorText>}
      <Button type="submit" size="lg" block loading={pending}>
        登录
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending || counting}
          onClick={() => sendCode(email)}
          className={linkButtonClass}
        >
          {resendLabel(resendLeft)}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setDevCode(null);
            setError(null);
          }}
          className={linkButtonClass}
        >
          换个邮箱
        </button>
      </div>
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
  const [picked, setChoice] = useState<string>(() => defaultBusinessChoice(businesses));
  const choice = businessChoice(picked, shops);
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
          setTakenHere([...takenHere, choice]); // the choice moves on by itself (businessChoice)
        }
        return setError(result.error);
      }
      onDone(result.employer);
    });
  }

  return (
    <form onSubmit={submit} noValidate className={`space-y-5 ${CARD}`}>
      <div>
        <h2 className="text-subtitle font-semibold">开通雇主身份</h2>
        <p className="mt-1 text-meta text-muted">
          已登录：<span className="break-all">{email}</span>
          。选择你的企业，发布的职位会显示这家企业。演示版可以选下面的演示店，或新建企业。
        </p>
      </div>
      <fieldset>
        <legend className={labelClass}>你的企业</legend>
        <div className="grid gap-2">
          {shops.map((b) => (
            <Choice key={b.id} value={b.id} current={choice} onPick={setChoice} disabled={b.claimed}>
              <ChoiceText
                title={b.name}
                text={`${b.regionName} · ${VERIFICATION_LABELS[b.verification].zh}${b.claimed ? " · 已有团队，需要管理员邀请" : ""}`}
              />
            </Choice>
          ))}
          <Choice value="new" current={choice} onPick={setChoice}>
            <ChoiceText title="新建企业" text="填写店名和地区；企业验证可以以后再做" />
          </Choice>
        </div>
      </fieldset>

      {choice === "new" && (
        <div className="space-y-4">
          <label className="block">
            <span className={labelClass}>店名</span>
            <input name="name" maxLength={40} autoComplete="organization" className={inputClass()} />
          </label>
          <Select
            name="regionId"
            label="地区"
            placeholder="请选择"
            required
            options={regions.map((r) => ({ value: r.id, label: r.nameZh }))}
          />
        </div>
      )}

      {error && <ErrorText>{error}</ErrorText>}
      <Button type="submit" size="lg" block loading={pending}>
        {pending ? "正在开通…" : "开通并开始发布招聘"}
      </Button>
    </form>
  );
}

/** A choice of the form as a card (Round 19): the Radio's whole row, outlined in brand colour once it is chosen. */
function ChoiceCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-control border border-border px-2 transition-colors duration-(--duration-press) has-checked:border-brand has-checked:bg-brand-soft has-disabled:bg-background has-disabled:text-muted">
      {children}
    </div>
  );
}

function ChoiceText({ title, text }: { title: string; text: string }) {
  return (
    <span className="block py-2.5">
      <span className="block font-medium">{title}</span>
      <span className="block text-meta text-muted">{text}</span>
    </span>
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
    <ChoiceCard>
      <Radio
        name="business"
        value={value}
        checked={current === value}
        disabled={disabled}
        onChange={() => onPick(value)}
        className="has-disabled:cursor-not-allowed"
      >
        {children}
      </Radio>
    </ChoiceCard>
  );
}

/** The page's title and what signing in is (the page and its loading.tsx). */
export function LoginIntro() {
  return (
    <>
      <h1 className="text-[1.75rem] leading-tight font-black lg:text-[2.125rem]">注册或登录</h1>
      <p className="mt-2 mb-5 text-body text-muted">
        用邮箱验证码注册或登录，不用设密码。同一个账号可以找工作，也可以开通雇主身份招人。
      </p>
    </>
  );
}

/** The form's shape while it is on its way: a card with the role choice, a field and the button. Hidden without JavaScript. */
export function LoginFormSkeleton({ label = "正在加载" }: { label?: string }) {
  return (
    <div data-nojs-hide="" aria-busy="true" className={`space-y-5 ${CARD}`}>
      <span className="sr-only">{label}</span>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

function Placeholder() {
  return (
    <>
      <LoginFormSkeleton />
      {/* Signing in runs in the browser (the code step, the session copy): say so instead of an endless placeholder. */}
      <noscript>
        <p className={`text-body ${CARD}`}>登录需要浏览器开启 JavaScript。职位列表和职位详情不用登录也能看。</p>
      </noscript>
    </>
  );
}

function ErrorText({ children }: { children: string }) {
  return (
    <p id="login-error" role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-body text-danger">
      {children}
    </p>
  );
}
