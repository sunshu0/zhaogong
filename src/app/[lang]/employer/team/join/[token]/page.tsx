import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Users } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { getAccount } from "@/lib/data";
import { JOIN_PATH, teamLinkState } from "@/db/team-links";
import { LINK_DAYS } from "@/components/employer/team";
import { TeamJoin } from "@/components/employer/TeamJoin";
import { StatusCard } from "@/components/seeker/StatusCard";
import { ButtonLink } from "@/components/ui/Button";
import { SkeletonList } from "@/components/ui/Skeleton";
import { contentLang } from "@/i18n/lang";
import { employerTeamMessages } from "@/i18n/messages/employer-team";
import { messages } from "@/i18n/server";

// 团队邀请链接 (#349, ADR 0028): the page an admin's link opens. Read per request: the token is checked against its
// hash, never listed or indexed, and no Referer carries it on. Signed out, it sends the visitor to sign in (a new email
// signs up) and back here; signed in, it asks for the name the team will see and joins as a member.
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: (await messages(employerTeamMessages)).teamJoin.metaTitle,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function TeamJoinPage({ params }: PageProps<"/[lang]/employer/team/join/[token]">) {
  const t = (await messages(employerTeamMessages)).teamJoin;
  return (
    <div className="mx-auto max-w-md space-y-4 pt-2">
      <Suspense fallback={<SkeletonList count={1} label={t.loading} />}>
        <Join params={params} />
      </Suspense>
    </div>
  );
}

async function Join({ params }: Pick<PageProps<"/[lang]/employer/team/join/[token]">, "params">) {
  await connection();
  const t = (await messages(employerTeamMessages)).teamJoin;
  const { token } = await params;
  const state = await teamLinkState(token);
  const card = (text: string, team = false) => (
    <StatusCard
      icon={Users}
      title={t.title}
      actions={<ButtonLink href={team ? "/employer/team" : "/"}>{team ? t.goTeam : t.home}</ButtonLink>}
    >
      {text}
    </StatusCard>
  );
  if (state.status === "invalid") return card(t.state.invalid);

  // A member opening the link again (used by then, if they joined with it) is told they are in the team.
  const session = await getCurrentSession();
  const account = session ? await getAccount(session.email) : undefined;
  if (account?.employerId === state.employerId && state.status !== "banned") return card(t.state.member, true);
  if (state.status === "expired") return card(t.state.expired(LINK_DAYS));
  if (state.status !== "open") return card(t.state[state.status]);
  if (account?.employerId) return card(t.state.has_business);

  const here = `${JOIN_PATH}${token}`;
  return (
    <section aria-labelledby="team-join-title" className="space-y-3 rounded-card bg-surface p-4 shadow-card">
      <h1 id="team-join-title" className="text-title font-semibold">
        {t.title}
      </h1>
      {/* The business's name is its own words, so it leads the line in its own lang (ADR 0023). */}
      <p className="text-body">
        <span lang={contentLang(state.employerName)} className="font-medium">
          {state.employerName}
        </span>
        {t.invited}
      </p>
      {session ? (
        <TeamJoin token={token} email={session.email} />
      ) : (
        <>
          <p className="text-meta text-muted">{t.signInHint}</p>
          <ButtonLink href={`/login?next=${encodeURIComponent(here)}`} block>
            {t.signIn}
          </ButtonLink>
        </>
      )}
    </section>
  );
}
