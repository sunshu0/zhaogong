"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { getMyJob } from "@/app/[lang]/employer/actions";
import { candidateContext } from "@/components/account/candidate-context";
import { useCandidateDirectory } from "@/components/seeker/hub-client";
import { useChat } from "@/components/seeker/chat-client";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { AvatarImage } from "@/components/seeker/ProfileAvatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { LoadFailed } from "@/components/ui/LoadFailed";
import { Group, Section } from "@/components/ui/Section";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Pay } from "@/components/ui/Pay";
import { regionById } from "@/config/countries";
import { formatEmploymentTypes } from "@/lib/employment-types";
import { candidateFacts, type Candidate } from "@/lib/candidate-matching";
import type { Job } from "@/lib/types";
import { useLang, useMessages } from "@/i18n/client";
import { seekerProfileMessages } from "@/i18n/messages/seeker-profile";
import { contentLang } from "@/i18n/lang";
import { placeName } from "@/components/seeker/format";
import { candidateMatchingMessages } from "@/i18n/messages/candidate-matching";

/**
 * /candidates/[id]: a job seeker's page as an employer sees it. Coming from a chat or 推荐人才, the top says which
 * job it is about and offers 回到聊天 or 发起聊天; the five facts employers check first come before the rest.
 */
export function CandidatePublicPage() {
  const lang = useLang();
  const t = useMessages(seekerProfileMessages);
  const c = t.candidate;
  // candidateFacts()'s word for a fact nobody filled in, in this language (line B's dictionary).
  const missing = useMessages(candidateMatchingMessages).facts.missing;
  const { id } = useParams<{ id: string }>();
  const jobParam = useSearchParams().get("job");
  const hydrated = useHydrated();
  const session = useSession();
  const { candidates, loaded, failed, reload } = useCandidateDirectory();
  const { conversations } = useChat();
  const candidate = candidates.find((item) => item.id === id && item.resume.discoverable);
  const isEmployer = session?.activeRole === "employer";
  const context = isEmployer ? candidateContext(conversations, id, jobParam) : { jobId: null, conversationId: null };
  const job = useOwnJob(context.jobId, isEmployer ? session.email : undefined);
  const chatHref = context.conversationId
    ? `/messages?conversation=${encodeURIComponent(context.conversationId)}`
    : "/messages";

  if (hydrated && !candidate && failed) return <LoadFailed what={c.profileWhat} onRetry={reload} />;
  if (!hydrated || (!candidate && !loaded)) return <SkeletonList count={2} label={t.pages.loadingProfileEllipsis} />;
  if (!candidate)
    return (
      <div className="space-y-4">
        <BackToChat href={chatHref} />
        <h1 className="text-title font-semibold">{c.unavailable}</h1>
        <p className="text-body text-muted">{c.unavailableHint}</p>
      </div>
    );

  return (
    <div className="space-y-section">
      {job ? (
        <JobBar job={job} candidate={candidate} chatHref={context.conversationId ? chatHref : null} />
      ) : (
        <BackToChat href={chatHref} />
      )}
      <Section look="app">
        <Group>
          <header className="flex items-start gap-4">
            <AvatarImage avatar={candidate.avatar} fallback={candidate.name} alt={t.avatar.alt(candidate.name)} large />
            <div className="min-w-0">
              <p className="text-meta text-muted">
                {c.page}
                {candidate.source === "demo" ? c.demo : ""}
              </p>
              <h1 lang={contentLang(candidate.name)} className="break-words text-title font-semibold">
                {candidate.name}
              </h1>
              <p lang={contentLang(candidate.headline)} className="mt-1 break-words text-body">
                {candidate.headline || c.noHeadline}
              </p>
              <p lang={contentLang(candidate.location)} className="mt-1 flex items-center gap-1 text-body text-muted">
                <MapPin aria-hidden="true" className="size-4 shrink-0" />
                {candidate.location || c.noRegion}
              </p>
            </div>
          </header>
        </Group>
        <Group>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-body" aria-label={c.facts}>
            {candidateFacts(candidate, lang).map((fact) => (
              <Fact
                key={fact.label}
                term={fact.label}
                value={fact.value === missing ? undefined : fact.value}
                empty={c.toFill}
              />
            ))}
          </dl>
        </Group>
      </Section>
      <Section look="app" id="candidate-about" title={c.about}>
        <Group>
          <p lang={contentLang(candidate.bio)} className="whitespace-pre-line break-words text-body leading-relaxed">
            {candidate.bio || c.noBio}
          </p>
        </Group>
      </Section>
      <Section look="app" id="candidate-preferences" title={c.preferences}>
        <Group>
          <dl className="grid gap-4 text-body sm:grid-cols-2">
            <Fact term={c.skills} value={candidate.resume.skills} empty={c.toFill} />
            <Fact
              term={c.employmentTypes}
              value={formatEmploymentTypes(candidate.resume.employmentTypes, lang)}
              empty={c.toFill}
            />
            <Fact
              term={c.regions}
              value={candidate.resume.regionIds
                .map((region) => placeName(regionById("NZ", region), lang) ?? region)
                .join(t.resume.listJoin)}
              empty={c.toFill}
            />
          </dl>
        </Group>
      </Section>
    </div>
  );
}

/** The employer's own job, read on the server (null when it is not theirs). */
function useOwnJob(jobId: string | null, email: string | undefined): Job | null {
  const [loaded, setLoaded] = useState<{ key: string; job: Job | null }>();
  const key = `${jobId}:${email}`;
  useEffect(() => {
    if (!jobId || !email) return;
    let live = true;
    // No answer: no job bar, only 回到聊天, as for a job that is not theirs.
    getMyJob(jobId).then(
      (job) => live && setLoaded({ key, job }),
      () => live && setLoaded({ key, job: null }),
    );
    return () => {
      live = false;
    };
  }, [jobId, email, key]);
  return loaded?.key === key ? loaded.job : null;
}

function JobBar({ job, candidate, chatHref }: { job: Job; candidate: Candidate; chatHref: string | null }) {
  const c = useMessages(seekerProfileMessages).candidate;
  const lang = useLang();
  const router = useRouter();
  const { openCandidateChat } = useChat();
  const [opening, setOpening] = useState(false);
  return (
    <Section look="app">
      <div className="flex flex-wrap items-center justify-between gap-3 py-group">
        <div className="min-w-0">
          <p className="text-meta text-muted">{c.forJob}</p>
          <Link
            href={`/jobs/${job.id}`}
            lang={contentLang(job.titleZh)}
            className="pressable block truncate text-subtitle font-semibold hover:underline"
          >
            {job.titleZh}
          </Link>
          <p>
            <Pay pay={job.pay} country={job.country} lang={lang} />
          </p>
        </div>
        {chatHref ? (
          <ButtonLink href={chatHref}>{c.backToChat}</ButtonLink>
        ) : (
          <Button
            loading={opening}
            onClick={async () => {
              setOpening(true);
              const id = await openCandidateChat(candidate, job);
              if (id) router.push(`/messages?conversation=${encodeURIComponent(id)}`);
              else setOpening(false);
            }}
          >
            {c.startChat}
          </Button>
        )}
      </div>
    </Section>
  );
}

function BackToChat({ href }: { href: string }) {
  const c = useMessages(seekerProfileMessages).candidate;
  return (
    <Link href={href} className="pressable inline-flex min-h-11 items-center gap-2 text-body text-brand">
      <ArrowLeft aria-hidden="true" className="size-4" />
      {c.backToChat}
    </Link>
  );
}

function Fact({ term, value, empty }: { term: string; value?: string; empty: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-meta text-muted">{term}</dt>
      <dd
        lang={contentLang(value)}
        className={`mt-0.5 whitespace-pre-line break-words ${value?.trim() ? "" : "text-muted"}`}
      >
        {value?.trim() || empty}
      </dd>
    </div>
  );
}
