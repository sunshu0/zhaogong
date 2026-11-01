"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  accountStatus,
  businessBanNotice,
  openEmployerForAccount,
  requestSignInCode,
  signInAccount,
  type AccountStatus,
  type SignInField,
} from "@/app/[lang]/login/actions";
import { COUNTRIES } from "@/config/countries";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { VERIFICATION_LABELS } from "@/i18n/labels";
import { loginMessages } from "@/i18n/messages/login";
import type { EmployerVerification } from "@/lib/types";
import {
  businessChoice,
  defaultBusinessChoice,
  parseBusinessChoice,
  reconcileIdentity,
} from "@/components/seeker/identity";
import { resendLabel, secondsLeft } from "@/components/seeker/code-resend";
import { emailTypoFix } from "@/components/seeker/email-typos";
import { placeName } from "@/components/seeker/format";
import {
  isValidCode,
  isValidEmail,
  normalizeCode,
  normalizeEmail,
  safeNext,
  type ActiveRole,
} from "@/components/seeker/session";
import { setIdentity, signOut, startSession, useHydrated, useSession } from "@/components/seeker/session-client";
import { Button } from "@/components/ui/Button";
import { LoadFailed } from "@/components/ui/LoadFailed";
import { busyProps } from "@/components/ui/busy";
import { cardClass } from "@/components/ui/Card";
import { Radio } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { inputClass } from "@/components/ui/input-class";
import { staffNext } from "@/components/ui/nav";

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
  "pressable min-h-11 w-full rounded-control text-body text-muted underline underline-offset-2 hover:text-foreground disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";
/** The address a mistyped domain should have been (#185): a link-like button inside a sentence. */
const fixButtonClass =
  "pressable inline-flex min-h-11 items-center rounded-control font-medium break-all text-brand underline underline-offset-2 disabled:opacity-50 aria-disabled:opacity-50";

const ROLES: readonly ActiveRole[] = ["seeker", "employer"];
/** The business step's area Select: its trigger takes this id, for the focus on 请选择地区. */
const AREA_TRIGGER = "business-area";

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
  const lang = useLang();
  const t = useMessages(loginMessages);
  const [role, setRole] = useState<ActiveRole>(initialRole);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  // Outside production there is no mail service: the server also prints the code to its log and sends it back here.
  const [devCode, setDevCode] = useState<string | null>(null);
  // How long a code works and how soon another may be asked for, as the server says (lib/auth/config.ts).
  const [codeTimes, setCodeTimes] = useState({ validMinutes: 10, resendMinutes: 1 });
  const [error, setError] = useState<string | null>(null);
  // UI review 1 B: the box is marked (red, aria-invalid) only when the error is about what is in it (the server's
  // `field`) — not for a network error, a sign-in limit or 只开放给受邀的账号.
  const [errorField, setErrorField] = useState<SignInField>();
  const fail = (text: string | null, field?: SignInField) => {
    setError(text);
    setErrorField(text ? field : undefined);
  };
  const emailWrong = !!error && errorField === "email";
  const codeWrong = !!error && errorField === "code";
  const [pending, startTransition] = useTransition();
  // Employer route, signed in: the server says whether the account already has a business.
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
  // The account check that got no answer (#250): for whom, and how many times 重试 asked again.
  const [checkFailed, setCheckFailed] = useState<string | null>(null);
  const [checkTry, setCheckTry] = useState(0);
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
  // #189: the business step comes after a button that goes away: 登录 on the code step, 开通雇主身份 when already signed
  // in, or 重试 after the account check got no answer (UI audit 1 #13). Its heading takes the focus that button had.
  const [focusBusinessStep, setFocusBusinessStep] = useState(false);
  // Round 20: sign-in switched the page's language to the account's; after the business step the next page loads
  // whole, in it.
  const [reloadNext, setReloadNext] = useState(false);
  // #202: buttons that go away when pressed hand the focus on — 改用 … to the code field, 换个邮箱 to the email
  // field — instead of dropping it to the top of the page.
  const codeInput = useRef<HTMLInputElement>(null);
  const backToEmail = useRef(false);
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
      fail(null);
      setCheckedFor(null);
      setResendAt(0);
      setLeftEmail("");
      setFocusBusinessStep(false);
    };
  }, []);

  useEffect(() => {
    if (step !== "email" || !backToEmail.current) return;
    backToEmail.current = false;
    emailInput.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [counting]);

  const signedInEmail = session?.email;
  // ADR 0043: a staff account skips the identities altogether and goes on to 审核后台.
  const staff = !!session?.staff;
  useEffect(() => {
    if (role !== "employer" || staff || !signedInEmail || checkedFor === signedInEmail) return;
    let cancelled = false;
    accountStatus(signedInEmail).then(
      (status) => {
        if (cancelled) return;
        if (status?.employer) {
          setIdentity(reconcileIdentity("employer", status));
          router.replace(next);
        } else {
          setIdentity({ activeRole: "seeker" });
          setCheckedFor(signedInEmail);
        }
      },
      () => {
        if (!cancelled) setCheckFailed(signedInEmail);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [role, staff, signedInEmail, checkedFor, next, router, checkTry]);

  if (!hydrated) return <Placeholder />;

  if (session && role === "employer" && !staff) {
    if (checkFailed === session.email)
      return (
        <LoadFailed
          what={t.accountWhat}
          onRetry={() => {
            setCheckFailed(null);
            setCheckTry((n) => n + 1);
            setFocusBusinessStep(true);
          }}
        />
      );
    if (checkedFor !== session.email) return <LoginFormSkeleton label={t.checkingAccount} />;
    return (
      <BusinessStep
        email={session.email}
        businesses={businesses}
        focusHeading={focusBusinessStep}
        onDone={(employer) => {
          setIdentity({ activeRole: "employer", employer });
          if (reloadNext) location.assign(next);
          else router.replace(next);
        }}
      />
    );
  }

  if (session) {
    return (
      <div className={`space-y-3 ${CARD}`}>
        <p className="text-body">
          {t.signedIn.as}
          <span className="font-medium break-all">{session.email}</span>
        </p>
        <Button size="lg" block onClick={() => router.replace(staff ? staffNext(next) : next)}>
          {t.signedIn.continue}
        </Button>
        {!session.employerId && !staff && (
          <button
            type="button"
            onClick={() => {
              setRole("employer");
              setFocusBusinessStep(true);
            }}
            className={linkButtonClass}
          >
            {t.signedIn.setUpHiring}
          </button>
        )}
        <button type="button" onClick={signOut} className={linkButtonClass}>
          {t.signedIn.signOut}
        </button>
      </div>
    );
  }

  function waitBeforeResend(seconds: number) {
    const at = Date.now();
    setNow(at);
    setResendAt(at + seconds * 1000);
  }

  function sendCode(address: string, sent?: () => void) {
    fail(null);
    startTransition(async () => {
      const result = await requestSignInCode(address).catch(() => null);
      if (!result) return fail(t.networkError);
      if (!result.ok) {
        // Asked too soon (another tab, say): count down from what the server says is left.
        if (result.retryAfterSec) waitBeforeResend(result.retryAfterSec);
        return fail(result.error, result.field);
      }
      waitBeforeResend(result.resendInSec);
      setEmail(address);
      setDevCode(result.devCode ?? null);
      setCodeTimes({ validMinutes: result.validMinutes, resendMinutes: Math.ceil(result.resendInSec / 60) });
      setStep("code");
      sent?.();
    });
  }

  function submitEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = normalizeEmail(String(new FormData(e.currentTarget).get("email") ?? ""));
    if (!isValidEmail(value)) {
      fail(t.email.invalid, "email");
      emailInput.current?.focus(); // UI audit 1 B: to the box that needs fixing
      return;
    }
    sendCode(value);
  }

  function submitCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = normalizeCode(String(new FormData(e.currentTarget).get("code") ?? ""));
    if (!isValidCode(code)) {
      fail(t.code.invalid, "code");
      codeInput.current?.focus();
      codeInput.current?.select();
      return;
    }
    fail(null);
    startTransition(async () => {
      const result = await signInAccount(email, code, role).catch(() => null);
      if (!result) return fail(t.networkError);
      if (!result.ok) {
        fail(result.error, result.field);
        codeInput.current?.focus(); // a wrong or used-up code: ready to type the next one
        codeInput.current?.select();
        return;
      }
      finishSignIn(result.account, result.reload);
    });
  }

  /** `reload`: the account's language differs from the page's, so the next page loads whole, in it (Round 20). */
  function finishSignIn(account: AccountStatus, reload?: boolean) {
    if (account.staff) {
      // ADR 0043: no identity to choose; straight on to 审核后台 (or a page a staff account may stay on).
      startSession(account.email, reconcileIdentity("seeker", account));
      const to = staffNext(next);
      if (reload) location.assign(to);
      else router.replace(to);
      return;
    }
    if (role === "employer" && !account.employer) {
      // Signed in; the business step comes next.
      startSession(account.email, { activeRole: "seeker" });
      setCheckedFor(account.email);
      setFocusBusinessStep(true);
      setReloadNext(Boolean(reload));
      return;
    }
    startSession(account.email, reconcileIdentity(role, account));
    if (reload) location.assign(next);
    else router.replace(next);
  }

  return step === "email" ? (
    <form onSubmit={submitEmail} noValidate className={`space-y-5 ${CARD}`}>
      <fieldset>
        <legend className={labelClass}>{t.roles.legend}</legend>
        <div className="grid gap-2">
          {ROLES.map((option) => (
            <ChoiceCard key={option}>
              <Radio name="role" value={option} checked={role === option} onChange={() => setRole(option)}>
                <ChoiceText
                  title={option === "seeker" ? t.roles.seekerTitle : t.roles.employerTitle}
                  text={option === "seeker" ? t.roles.seekerText : t.roles.employerText}
                />
              </Radio>
            </ChoiceCard>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className={labelClass}>{t.email.label}</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          autoCapitalize="none"
          defaultValue={email}
          ref={emailInput}
          onBlur={(e) => setLeftEmail(e.currentTarget.value)}
          // Once the hint shows, it follows the typing, so it goes as soon as the domain is put right.
          onChange={(e) => {
            if (typoFix) setLeftEmail(e.currentTarget.value);
          }}
          placeholder="you@example.com"
          aria-invalid={emailWrong || undefined}
          aria-describedby={emailWrong ? "login-error" : undefined}
          className={inputClass({ tone: emailWrong ? "danger" : undefined })}
        />
      </label>
      {error && <ErrorText>{error}</ErrorText>}
      <Button type="submit" size="lg" block loading={pending}>
        {pending ? t.email.sending : t.email.send}
      </Button>
      {/* Below the button, so a hint that appears as the field is left (tapping the button) does not move it. */}
      <p className="sr-only" aria-live="polite">
        {typoFix ? t.email.typoAnnounce(typoFix) : ""}
      </p>
      {typoFix && (
        <p className="text-body">
          {t.email.typoBefore}{" "}
          <button
            type="button"
            aria-label={t.email.typoFixLabel(typoFix)}
            onClick={() => {
              if (emailInput.current) emailInput.current.value = typoFix;
              setLeftEmail(typoFix);
              // The button goes once the address is right: the focus goes back to the field (#202, UI audit 1 #12).
              emailInput.current?.focus();
            }}
            className={fixButtonClass}
          >
            {typoFix}
          </button>
          {t.email.typoAfter}
        </p>
      )}
      <p className="text-meta text-muted">{t.email.note}</p>
    </form>
  ) : (
    <form onSubmit={submitCode} noValidate className={`space-y-4 ${CARD}`}>
      <p className="text-body">
        {t.code.sentTo} <span className="font-medium break-all">{email}</span>
      </p>
      {sentTypoFix && (
        <p className="text-body">
          {t.code.typoQuestion}{" "}
          <button
            type="button"
            onClick={() => sendCode(sentTypoFix, () => codeInput.current?.focus())}
            className={fixButtonClass}
            {...busyProps(pending)}
          >
            {t.code.useInstead(sentTypoFix)}
          </button>
        </p>
      )}
      {devCode ? (
        <p className="rounded-control bg-brand-soft px-3 py-2 text-meta text-brand">
          {t.code.devNote}
          <span data-testid="dev-sign-in-code" className="ml-1 font-mono text-body font-semibold tracking-widest">
            {devCode}
          </span>
        </p>
      ) : (
        <p className="text-meta text-muted">{t.code.validity(codeTimes.validMinutes, codeTimes.resendMinutes)}</p>
      )}
      <label className="block">
        <span className={labelClass}>{t.code.label}</span>
        <input
          ref={codeInput}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          spellCheck={false}
          autoCapitalize="none"
          // #290: room for a pasted "123 456" or full-width digits, cleaned to the six digits as they come in (a
          // maxLength of 6 cut the paste before it could be cleaned).
          maxLength={16}
          onChange={(event) => {
            const clean = normalizeCode(event.currentTarget.value).slice(0, 6);
            if (clean !== event.currentTarget.value) event.currentTarget.value = clean;
          }}
          placeholder={t.code.placeholder}
          autoFocus
          aria-invalid={codeWrong || undefined}
          aria-describedby={codeWrong ? "login-error" : undefined}
          className={`${inputClass({ tone: codeWrong ? "danger" : undefined })} font-figure tracking-[0.4em]`}
        />
      </label>
      {error && <ErrorText>{error}</ErrorText>}
      <Button type="submit" size="lg" block loading={pending}>
        {t.code.submit}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          // Counting down it cannot be pressed yet, but stays focusable (the focus was on it when it was pressed).
          aria-disabled={counting || undefined}
          onClick={() => {
            if (!counting) sendCode(email);
          }}
          className={linkButtonClass}
          {...busyProps(pending)}
        >
          {resendLabel(resendLeft, lang)}
        </button>
        <button
          type="button"
          onClick={() => {
            backToEmail.current = true;
            setStep("email");
            setDevCode(null);
            fail(null);
          }}
          className={linkButtonClass}
        >
          {t.code.otherEmail}
        </button>
      </div>
    </form>
  );
}

/** The employer identity's business: one of the demo businesses, or a new one (name + region). */
function BusinessStep({
  email,
  businesses,
  focusHeading = false,
  onDone,
}: {
  email: string;
  businesses: DemoBusiness[];
  /** Coming from the code step, whose 登录 button had the focus (#189). */
  focusHeading?: boolean;
  onDone: (employer: { id: string; name: string }) => void;
}) {
  const lang = useLang();
  const t = useMessages(loginMessages);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusHeading) heading.current?.focus();
  }, [focusHeading]);
  // Shops the server refused as taken since this page loaded (someone bound one in the meantime).
  const [takenHere, setTakenHere] = useState<readonly string[]>([]);
  const shops = businesses.map((b) => (takenHere.includes(b.id) ? { ...b, claimed: true } : b));
  const [picked, setChoice] = useState<string>(() => defaultBusinessChoice(businesses));
  const choice = businessChoice(picked, shops);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const regions = COUNTRIES.NZ.regions;
  const nameInput = useRef<HTMLInputElement>(null);
  // UI review 1 B: 请填写店名 and 店名最多… go under the name box and mark it; 请选择地区 marks the area.
  const [errorField, setErrorField] = useState<"name" | "regionId">();
  const nameWrong = !!error && errorField === "name";
  const areaWrong = !!error && errorField === "regionId";
  // ADR 0044: the account's business is banned; nothing to set up here until it is over.
  const [banned, setBanned] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    businessBanNotice().then(
      (notice) => !cancelled && setBanned(notice),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const payload =
      choice === "new"
        ? { kind: "new", name: String(data.get("name") ?? ""), regionId: String(data.get("regionId") ?? "") }
        : { kind: "existing", employerId: choice };
    // The server checks the same; asked here first, the person goes straight back to the box.
    const checked = choice === "new" ? parseBusinessChoice(payload, "NZ", lang) : null;
    if (checked && !checked.ok) {
      // parseBusinessChoice asks for the name first, then the area.
      const field = checked.error === t.identity.areaMissing ? "regionId" : "name";
      setError(checked.error);
      setErrorField(field);
      // Rework 6: to the box to fix, the area's Select trigger too.
      if (field === "name") nameInput.current?.focus();
      else document.getElementById(AREA_TRIGGER)?.focus();
      return;
    }
    setError(null);
    setErrorField(undefined);
    startTransition(async () => {
      const result = await openEmployerForAccount(email, payload).catch(() => null);
      if (!result) return setError(t.networkError);
      if (!result.ok) {
        if (choice !== "new" && result.reason === "taken") {
          setTakenHere([...takenHere, choice]); // the choice moves on by itself (businessChoice)
        }
        return setError(result.error);
      }
      onDone(result.employer);
    });
  }

  if (banned)
    return (
      <section className={`space-y-3 ${CARD}`}>
        <h2 ref={heading} tabIndex={-1} className="text-subtitle font-semibold outline-none">
          {t.hiring.title}
        </h2>
        <p role="status" className="rounded-control bg-danger-soft px-3 py-2 text-body text-danger">
          {banned}
        </p>
      </section>
    );

  return (
    <form onSubmit={submit} noValidate className={`space-y-5 ${CARD}`}>
      <div>
        <h2 ref={heading} tabIndex={-1} className="text-subtitle font-semibold outline-none">
          {t.hiring.title}
        </h2>
        <p className="mt-1 text-meta text-muted">
          {t.hiring.signedInAs}
          <span className="break-all">{email}</span>
          {t.hiring.introAfter}
        </p>
      </div>
      <fieldset>
        <legend className={labelClass}>{t.hiring.legend}</legend>
        <div className="grid gap-2">
          {shops.map((b) => (
            <Choice key={b.id} value={b.id} current={choice} onPick={setChoice} disabled={b.claimed}>
              <ChoiceText
                title={b.name}
                text={t.hiring.businessMeta(b.regionName, VERIFICATION_LABELS[b.verification][lang], b.claimed)}
              />
            </Choice>
          ))}
          <Choice value="new" current={choice} onPick={setChoice}>
            <ChoiceText title={t.hiring.newTitle} text={t.hiring.newText} />
          </Choice>
        </div>
      </fieldset>

      {choice === "new" && (
        <div className="space-y-4">
          <label className="block">
            <span className={labelClass}>{t.hiring.nameLabel}</span>
            <input
              ref={nameInput}
              name="name"
              maxLength={40}
              autoComplete="organization"
              aria-invalid={nameWrong || undefined}
              aria-describedby={nameWrong ? "business-name-error" : undefined}
              className={inputClass({ tone: nameWrong ? "danger" : undefined })}
            />
          </label>
          {nameWrong && <ErrorText id="business-name-error">{error}</ErrorText>}
          <Select
            id={AREA_TRIGGER}
            name="regionId"
            label={t.hiring.areaLabel}
            placeholder={t.hiring.areaPlaceholder}
            required
            tone={areaWrong ? "danger" : undefined}
            aria-describedby={areaWrong ? "business-area-error" : undefined}
            options={regions.map((r) => ({ value: r.id, label: placeName(r, lang) ?? r.nameZh }))}
          />
          {areaWrong && <ErrorText id="business-area-error">{error}</ErrorText>}
        </div>
      )}

      {error && !nameWrong && !areaWrong && <ErrorText>{error}</ErrorText>}
      <Button type="submit" size="lg" block loading={pending}>
        {pending ? t.hiring.submitting : t.hiring.submit}
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
      <span lang={contentLang(title)} className="block font-medium">
        {title}
      </span>
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
  const t = useMessages(loginMessages);
  return (
    <>
      <h1 className="text-[1.75rem] leading-tight font-black lg:text-[2.125rem]">{t.title}</h1>
      <p className="mt-2 mb-5 text-body text-muted">{t.intro}</p>
    </>
  );
}

/** The form's shape while it is on its way: a card with the role choice, a field and the button. Hidden without JavaScript. */
export function LoginFormSkeleton({ label }: { label?: string }) {
  const t = useMessages(loginMessages);
  return (
    <div data-nojs-hide="" aria-busy="true" className={`space-y-5 ${CARD}`}>
      <span className="sr-only">{label ?? t.loading}</span>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

function Placeholder() {
  const t = useMessages(loginMessages);
  return (
    <>
      <LoginFormSkeleton />
      {/* Signing in runs in the browser (the code step, the session copy): say so instead of an endless placeholder. */}
      <noscript>
        <p className={`text-body ${CARD}`}>{t.noScript}</p>
      </noscript>
    </>
  );
}

function ErrorText({ children, id = "login-error" }: { children: string; id?: string }) {
  return (
    <p id={id} role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-body text-danger">
      {children}
    </p>
  );
}
