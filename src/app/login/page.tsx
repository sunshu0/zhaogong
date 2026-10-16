import type { Metadata } from "next";
import { NoScriptStreams } from "@/components/seeker/NoScriptStreams";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCurrentSession } from "@/lib/auth";
import { regionById } from "@/config/countries";
import { listClaimedEmployerIds, listEmployers } from "@/lib/data";
import { DEMO_BUSINESS_IDS, parseRole } from "@/components/seeker/identity";
import { LoginForm, type DemoBusiness } from "@/components/seeker/LoginForm";
import { nextForSignedIn } from "@/components/seeker/session";

export const metadata: Metadata = { title: "注册或登录", robots: { index: false } };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-sm pt-4">
      <h1 className="text-lg font-semibold">注册或登录</h1>
      <p className="mt-1 mb-4 text-sm text-muted">
        用邮箱验证码注册或登录，不用设密码。同一个账号可以找工作，也可以开通雇主身份招人。
      </p>
      <NoScriptStreams />
      <Suspense
        fallback={<div data-nojs-hide="" className="h-40 animate-pulse rounded-xl border border-border bg-surface" />}
      >
        <Login searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  // Already signed in (a tap on 我的 before the page knew it, an old link): straight on to where it was going (#109).
  // The session is checked against the request's time, so wait for the request first (#100's rule).
  await connection();
  const session = await getCurrentSession();
  const onward = session && nextForSignedIn(params.next, params.role, session.activeRole);
  if (onward) redirect(onward);
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  const role = parseRole(params.role);
  // A different ?role= or ?next= is a different sign-in: start the form over.
  return (
    <LoginForm key={`${role}|${next ?? ""}`} initialRole={role} nextParam={next} businesses={await demoBusinesses()} />
  );
}

/** The businesses an employer can pick at sign-up in the demo (banned ones left out; bound ones marked). */
async function demoBusinesses(): Promise<DemoBusiness[]> {
  const ids: readonly string[] = DEMO_BUSINESS_IDS;
  const claimed = new Set(await listClaimedEmployerIds());
  return (await listEmployers())
    .filter((e) => ids.includes(e.id) && !e.bannedAt)
    .map((e) => ({
      id: e.id,
      name: e.name,
      regionName: regionById("NZ", e.regionId)?.nameZh ?? "",
      verification: e.verification,
      claimed: claimed.has(e.id),
    }));
}
