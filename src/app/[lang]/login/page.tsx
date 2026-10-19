import type { Metadata } from "next";
import { NoScriptStreams } from "@/components/seeker/NoScriptStreams";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCurrentSession } from "@/lib/auth";
import { regionById } from "@/config/countries";
import { placeName } from "@/components/seeker/format";
import { listClaimedEmployerIds, listEmployers } from "@/lib/data";
import { demoDataWanted } from "@/db/ready";
import { DEMO_BUSINESS_IDS, parseRole } from "@/components/seeker/identity";
import { LoginForm, LoginFormSkeleton, LoginIntro, type DemoBusiness } from "@/components/seeker/LoginForm";
import { nextForSignedIn } from "@/components/seeker/session";
import { TrackView } from "@/components/ui/TrackView";
import { loginMessages } from "@/i18n/messages/login";
import { messages, serverLang } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(loginMessages)).title, robots: { index: false } };
}

// Round 19 (操作质感): the app's type (`type-app`), a large title and the form as a card.
export default function LoginPage({ searchParams }: PageProps<"/[lang]/login">) {
  return (
    <div className="type-app mx-auto max-w-md pt-2 lg:pt-8">
      <LoginIntro />
      <NoScriptStreams />
      <Suspense fallback={<LoginFormSkeleton />}>
        <Login searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Login({ searchParams }: Pick<PageProps<"/[lang]/login">, "searchParams">) {
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
    <>
      {/* The sign-in funnel's first step (#314, ADR 0025 §4); one already signed in left above. */}
      <TrackView event={{ name: "signin_view", path: "/login", detail: role }} />
      <LoginForm
        key={`${role}|${next ?? ""}`}
        initialRole={role}
        nextParam={next}
        businesses={await demoBusinesses()}
      />
    </>
  );
}

/**
 * The businesses an employer can pick at sign-up in the demo (banned ones left out; bound ones marked). None without
 * the demo data (#348): the server would refuse them, and their ids may be real businesses.
 */
async function demoBusinesses(): Promise<DemoBusiness[]> {
  if (!demoDataWanted()) return [];
  const lang = await serverLang();
  const ids: readonly string[] = DEMO_BUSINESS_IDS;
  const claimed = new Set(await listClaimedEmployerIds());
  return (await listEmployers())
    .filter((e) => ids.includes(e.id) && !e.bannedAt)
    .map((e) => ({
      id: e.id,
      name: e.name,
      regionName: placeName(regionById("NZ", e.regionId), lang) ?? "",
      verification: e.verification,
      claimed: claimed.has(e.id),
    }));
}
