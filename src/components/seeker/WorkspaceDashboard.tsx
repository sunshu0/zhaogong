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
import { Section } from "@/components/ui/Section";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useLang, useMessages } from "@/i18n/client";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";

/** 总览 (/workspace): only what needs doing, most urgent first; one sentence and one button when nothing does. */
export function WorkspaceDashboard() {
  const lang = useLang();
  const t = useMessages(seekerMeMessages).workspace;
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";
  const employerEmail = isEmployer ? session.email : undefined;
  const { conversations, unread, exchanges } = useChat();
  const { profile } = useProfile();
  const jobs = useMyJobs(employerEmail).ready;
  const employer = useEmployerProfile(employerEmail).profile;
  const verification = useMyVerification(employerEmail).request;
  const interviews = useInterviewTodos(session);
  // An employer's jobs and verification, and either side's interviews, come from the server; wait for them rather
  // than list a stale to-do.
  const loading = (isEmployer && (!jobs || !employer || verification === undefined)) || !interviews;

  const progress = profileProgress(profileChecklist(profile, isEmployer, employer?.verification));
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
  });

  return (
    <div className="space-y-section">
      <header>
        <h1 className="text-title font-semibold">{workspaceTitle(isEmployer, lang)}</h1>
        <p className="mt-0.5 text-meta text-muted">
          {[isEmployer && session?.employerName, !loading && todos.length > 0 && t.toDo(todos.length)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>
      {loading ? (
        <SkeletonList count={2} label={t.loadingTodos} />
      ) : todos.length ? (
        <Section look="app" id="todos" title={t.todos}>
          <LinkList
            label={t.todos}
            items={todos.map((todo) => ({ href: todo.href, label: todo.title, detail: todo.detail }))}
          />
        </Section>
      ) : (
        <Section look="app">
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
