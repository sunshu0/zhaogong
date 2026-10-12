"use client";
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { VERIFICATION_LABELS } from "@/i18n/labels";
import type { Employer } from "@/lib/types";
import { lookupBusiness, verifyBusiness } from "@/app/employer/actions";
import type { RegisterEntry } from "@/components/employer/business-register";
import { useEmployerSession } from "@/components/employer/session";
import { SignInPanel } from "@/components/employer/SignInPanel";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";

/** Look up the business register by name or NZBN, then claim the entry to show 已验证企业. */
export function VerifyBusiness({ accounts }: { accounts: Employer[] }) {
  const session = useEmployerSession();
  const employerId = session?.employerId;
  const { profile, reload } = useEmployerProfile(employerId);
  const employer = profile ?? accounts.find((a) => a.id === employerId);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ results: RegisterEntry[]; error_zh?: string }>();
  const [claiming, setClaiming] = useState<string>();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const messageRef = useFocusOnChange<HTMLParagraphElement>(message);
  const [pending, startTransition] = useTransition();

  function search(e: FormEvent) {
    e.preventDefault();
    setMessage(undefined);
    startTransition(async () => setFound(await lookupBusiness(query)));
  }

  function verify(nzbn: string) {
    if (!employerId) return setClaiming(nzbn);
    startTransition(async () => {
      const result = await verifyBusiness(employerId, nzbn);
      setMessage(
        result.ok
          ? { ok: true, text: `已验证：${result.employer.legalName}（NZBN ${result.employer.businessNumber}）。你的职位会显示「${VERIFICATION_LABELS[result.employer.verification].zh}」。` }
          : { ok: false, text: result.error_zh },
      );
      setClaiming(undefined);
      reload();
    });
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">企业验证</h1>
        {employer ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            {employer.name} 现在是 <VerificationBadge verification={employer.verification} />
            {employer.businessNumber && <span className="text-muted">NZBN {employer.businessNumber}</span>}
          </p>
        ) : (
          <p className="text-sm text-muted">用公司名称或 NZBN 在新西兰企业登记里查找你的公司。</p>
        )}
      </header>

      <BadgeMeaning />

      <form onSubmit={search} className="space-y-2">
        <label htmlFor="verify-query" className="block text-sm font-medium">
          公司名称或 NZBN
        </label>
        <div className="flex gap-2">
          <input
            id="verify-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如：Demo Yuemei 或 9429000000004"
            className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3"
          />
          <button type="submit" disabled={pending || !query.trim()} className="h-11 rounded-lg bg-brand px-4 font-medium text-white disabled:opacity-40">
            查询
          </button>
        </div>
        <p className="text-xs text-muted">演示版查的是一份示例登记；正式版会连新西兰企业登记（NZBN）。</p>
      </form>

      {message && (
        <p ref={messageRef} tabIndex={-1} role="status" className={`rounded-lg px-3 py-2 text-sm outline-none ${message.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>
          {message.text}
        </p>
      )}

      {found?.error_zh && <p className="text-sm text-warn">{found.error_zh}</p>}
      {found && found.results.length > 0 && (
        <ul className="space-y-2">
          {found.results.map((entry) => {
            const mine = employer?.businessNumber === entry.nzbn;
            return (
              <li key={entry.nzbn} className="rounded-xl border border-border bg-surface p-4">
                <p className="font-medium" lang="en">
                  {entry.legalName}
                </p>
                <p className="text-sm text-muted">
                  NZBN {entry.nzbn} · 商号：{entry.tradingNames.join("、")}
                </p>
                <p className={`mt-1 text-sm ${entry.status === "registered" ? "text-ok" : "text-danger"}`}>
                  {entry.status === "registered" ? "登记状态：正常" : "登记状态：已注销"}
                </p>
                {mine ? (
                  <p className="mt-2 text-sm text-ok">这是你已验证的公司。</p>
                ) : (
                  <button
                    type="button"
                    disabled={entry.status !== "registered" || pending}
                    onClick={() => verify(entry.nzbn)}
                    className="mt-3 h-10 w-full rounded-lg border border-brand text-sm font-medium text-brand disabled:border-border disabled:text-muted"
                  >
                    这是我的公司，用它验证
                  </button>
                )}
                {claiming === entry.nzbn && !employerId && (
                  <div className="mt-3">
                    <SignInPanel accounts={accounts} intro="验证前请先登录，选好要验证的店铺。" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted">
        演示说明：正式版还会确认你能代表这家公司（例如向登记的公司邮箱发送确认码），之后才显示标识。
        <Link href="/employer/jobs" className="ml-1 text-brand underline">
          回到管理职位
        </Link>
      </p>
    </div>
  );
}

function BadgeMeaning() {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed">
      <div>
        <h2 className="font-medium text-ok">「已验证企业」是什么</h2>
        <p className="mt-1">我们核对了新西兰企业登记：这家公司真实存在、登记状态正常，职位上会显示登记的公司名称和 NZBN。求职者更愿意联系有标识的雇主。</p>
      </div>
      <div>
        <h2 className="font-medium text-warn">它不代表什么</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>不代表我们担保工资、工时或工作条件。</li>
          <li>不是移民局的「认证雇主」（Accredited Employer），也不代表能办理任何签证。</li>
          <li>不是对职位内容的背书。求职者遇到收费、低于最低工资等情况，仍然可以举报。</li>
        </ul>
      </div>
    </section>
  );
}
