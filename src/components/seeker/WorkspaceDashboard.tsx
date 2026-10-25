"use client";

import { profileChecklist, profileProgress } from "@/components/account/profile-checklist";
import { workspaceTodos } from "@/components/account/todos";
import { useEmployerProfile, useMyVerification } from "@/components/employer/use-employer";
import { useMyJobs } from "@/components/employer/use-my-jobs";
import { useChat } from "@/components/seeker/chat-client";
import { useInterviewTodos } from "@/components/seeker/interview-client";
import { useProfile } from "@/components/seeker/hub-client";
import { useSession } from "@/components/seeker/session-client";
import { workspaceTitle } from "@/components/seeker/workspace";
import { ButtonLink } from "@/components/ui/Button";
import { LinkList } from "@/components/ui/LinkList";
import { LoadFailed } from "@/components/ui/LoadFailed";
import { Section } from "@/components/ui/Section";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useLang, useMessages } from "@/i18n/client";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";
import { contentLang } from "@/i18n/lang";

/** 总览 (/workspace): only what needs doing, most urgent first; one sentence and one button when nothing does. */
export function WorkspaceDashboard() {
  const lang = useLang();
  const t = useMessages(seekerMeMessages).workspace;
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";
  const employerEmail = isEmployer ? session.email : undefined;
  const { conversations, unread, exchanges } = useChat();
  const { profile } = useProfile();
  const myJobs = useMyJobs(employerEmail);
  const myEmployer = useEmployerProfile(employerEmail);
  const myVerification = useMyVerification(employerEmail);
  const jobs = myJobs.ready;
  const employer = myEmployer.profile;
  const verification = myVerification.request;
  const { todos: interviews, failed: interviewsFailed, reload: reloadInterviews } = useInterviewTodos(session);
  // The business's jobs, page and verification that got no answer (#246, ADR 0024): said with 重试, which asks again
  // for the ones that failed, and no to-do list built without them.
  const employerFailed = isEmployer && (myJobs.failed || myEmployer.failed || myVerification.failed);
  const reloadEmployer = () => {
    for (const load of [myJobs, myEmployer, myVerification]) if (load.failed) load.reload();
  };
  // An employer's jobs and verification, and either side's interviews, come from the server; wait for them rather
  // than list a stale to-do.
  const loading = (isEmployer && !employerFailed && (!jobs || !employer || verification === undefined)) || !interviews;

  const progress = profileProgress(profileChecklist(profile, isEmployer, employer?.verification, lang));
  const todos = workspaceTodos({
    isEmployer,
    conversations,
    unread,
    exchanges,
    interviews,
    jobs: jobs?.jobs,
    unseenApplications: jobs
      ? Object.fromEntries(Object.entries(jobs.applications).map(([id, count]) => [id, count.unseen]))
      : undefined,
    now: jobs?.now ?? 0,
    profileMissing: { count: progress.missing.length, labels: progress.missing.map((item) => item.label) },
    verification,
    lang,
  });

  return (
    <div className="space-y-section">
      <header>
        <h1 className="text-title font-semibold">{workspaceTitle(isEmployer, lang)}</h1>
        <p className="mt-0.5 text-meta text-muted">
          {/* #243: the business's name is its own words, marked so the English page reads it as Chinese. */}
          {isEmployer && session?.employerName && (
            <span lang={contentLang(session.employerName)}>{session.employerName}</span>
          )}
          {isEmployer && session?.employerName && !loading && !employerFailed && todos.length > 0 && " · "}
          {!loading && !employerFailed && todos.length > 0 && t.toDo(todos.length)}
        </p>
      </header>
      {employerFailed && <LoadFailed what={t.employerWhat} onRetry={reloadEmployer} />}
      {interviewsFailed && <LoadFailed what={t.interviewsWhat} onRetry={reloadInterviews} />}
      {employerFailed ? null : loading ? (
        <SkeletonList count={2} label={t.loadingTodos} />
      ) : todos.length || interviewsFailed ? (
        todos.length > 0 && (
          <Section look="sheet" id="todos" title={t.todos}>
            <LinkList
              label={t.todos}
              items={todos.map((todo) => ({ href: todo.href, label: todo.title, detail: todo.detail }))}
            />
          </Section>
        )
      ) : (
        <Section look="sheet">
          <div className="py-10 text-center">
            <p className="text-subtitle">{t.allDone}</p>
            <p className="mt-1 text-meta text-muted">{isEmployer ? t.employerEmpty : t.seekerEmpty}</p>
            <ButtonLink href={isEmployer ? "/employer/post" : "/jobs"} className="mt-4">
              {isEmployer ? t.postJob : t.browse}
            </ButtonLink>
          </div>
        </Section>
      )}
    </div>
  );
}
