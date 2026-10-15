"use client";

import { profileChecklist, profileProgress } from "@/components/account/profile-checklist";
import { workspaceTodos } from "@/components/account/todos";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { useMyJobs } from "@/components/employer/use-my-jobs";
import { useChat } from "@/components/seeker/chat-client";
import { useProfile } from "@/components/seeker/hub-client";
import { useSession } from "@/components/seeker/session-client";
import { workspaceTitle } from "@/components/seeker/workspace";
import { ButtonLink } from "@/components/ui/Button";
import { LinkList } from "@/components/ui/LinkList";
import { Section } from "@/components/ui/Section";

/** 总览 (/workspace): only what needs doing, most urgent first; one sentence and one button when nothing does. */
export function WorkspaceDashboard() {
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";
  const employerEmail = isEmployer ? session.email : undefined;
  const { conversations, unread, exchanges } = useChat();
  const { profile } = useProfile();
  const jobs = useMyJobs(employerEmail).ready;
  const employer = useEmployerProfile(employerEmail).profile;
  // An employer's jobs and verification come from the server; wait for them rather than list a stale to-do.
  const loading = isEmployer && (!jobs || !employer);

  const progress = profileProgress(profileChecklist(profile, isEmployer, employer?.verification));
  const todos = workspaceTodos({
    isEmployer,
    conversations,
    unread,
    exchanges,
    jobs: jobs?.jobs,
    now: jobs?.now ?? 0,
    profileMissing: { count: progress.missing.length, labels: progress.missing.map((item) => item.label) },
  });

  return (
    <div className="space-y-section">
      <header>
        <h1 className="text-title font-semibold">{workspaceTitle(isEmployer)}</h1>
        <p className="mt-0.5 text-meta text-muted">
          {[isEmployer && session?.employerName, !loading && todos.length > 0 && `${todos.length} 件事要处理`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>
      {loading ? (
        <div className="h-40 animate-pulse rounded-xl border border-border bg-surface" aria-hidden="true" />
      ) : todos.length ? (
        <Section id="todos" title="待办">
          <LinkList
            label="待办"
            items={todos.map((todo) => ({ href: todo.href, label: todo.title, detail: todo.detail }))}
          />
        </Section>
      ) : (
        <Section>
          <div className="py-10 text-center">
            <p className="text-subtitle">都处理完了</p>
            <p className="mt-1 text-meta text-muted">
              {isEmployer ? "新的应聘和聊天会出现在这里。" : "有新消息或交换请求时会出现在这里。"}
            </p>
            <ButtonLink href={isEmployer ? "/employer/post" : "/jobs"} className="mt-4">
              {isEmployer ? "发布职位" : "去看职位"}
            </ButtonLink>
          </div>
        </Section>
      )}
    </div>
  );
}
