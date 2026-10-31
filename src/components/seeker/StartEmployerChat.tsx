"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { useChat } from "@/components/seeker/chat-client";
import { writeDraftIfEmpty } from "@/components/seeker/chat-drafts";
import { loadChatPhrases, useChatPhrases } from "@/components/seeker/chat-phrases-client";
import { identityScope } from "@/components/seeker/identity-scope";
import type { DemoSession } from "@/components/seeker/session";
import { setIdentity, useHydrated, useSession } from "@/components/seeker/session-client";
import type { Employer, Job } from "@/lib/types";
import { fillOpener, openerText } from "@/lib/chat-phrases";
import { buttonClass, type ButtonSize } from "@/components/ui/Button";
import { useLang, useMessages } from "@/i18n/client";
import { chatMessages } from "@/i18n/messages/chat";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import { track } from "@/lib/events/track";

export type ChatJob = Pick<Job, "id" | "employerId" | "titleZh" | "titleEn" | "status" | "expiresAt">;
/**
 * 立即沟通: the job page's main action. `size="lg"` in the job page's action bar (Round 19); the label never wraps.
 * `variant="secondary"` where it repeats on every job of a list (an employer's page), so the screen keeps one main
 * button (visual A).
 */
export function StartEmployerChat({
  employer,
  job,
  closed = false,
  size = "md",
  variant = "primary",
}: {
  employer: Pick<Employer, "id" | "name">;
  job: ChatJob;
  closed?: boolean;
  size?: ButtonSize;
  variant?: "primary" | "secondary";
}) {
  const t = useMessages(seekerJobsMessages).chat;
  const chatButton = `${buttonClass(variant, { size })} font-semibold whitespace-nowrap`;
  const session = useSession();
  const hydrated = useHydrated();
  const router = useRouter();
  const lang = useLang();
  const openers = useMessages(chatMessages).phrases.openers;
  const { openEmployerChat, messages } = useChat();
  const [error, setError] = useState("");
  // The 开场白 (#373) loads ahead, so 立即沟通 seldom waits for it.
  useChatPhrases(session?.activeRole === "seeker" ? session.email : undefined);
  if (closed)
    return <span className="inline-flex min-h-11 items-center text-body whitespace-nowrap text-muted">{t.closed}</span>;
  if (session?.employerId === employer.id)
    return (
      <Link href="/employer/jobs" className="inline-flex min-h-11 items-center text-body text-brand underline">
        {t.manageOwn}
      </Link>
    );
  if (!hydrated || !session)
    return (
      <Link
        href={`/login?role=seeker&next=${encodeURIComponent(`/jobs/${job.id}`)}`}
        // The funnel (#319, ADR 0025): 立即沟通 pressed while signed out goes to sign in first.
        onClick={() => track({ name: "chat_start", path: "/jobs/[id]", jobId: job.id, detail: "signed_out" })}
        className={chatButton}
      >
        <MessageSquare aria-hidden="true" className="size-4" />
        {t.start}
      </Link>
    );
  if (session.activeRole === "employer")
    return (
      <button
        type="button"
        onClick={() =>
          setIdentity({
            activeRole: "seeker",
            employer: session.employerId ? { id: session.employerId, name: session.employerName ?? "" } : undefined,
          })
        }
        className={chatButton}
      >
        <MessageSquare aria-hidden="true" className="size-4" />
        {t.switchToSeeker}
      </button>
    );
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={async () => {
          const empty = (id: string) => !messages[id]?.length;
          const id = openEmployerChat(employer, job);
          if (!id) return setError(t.stopped);
          track({ name: "chat_start", path: "/jobs/[id]", jobId: job.id });
          if (empty(id)) {
            const kept = await loadChatPhrases(session.email);
            const title = lang === "en" && job.titleEn ? job.titleEn : job.titleZh;
            putOpener(session, id, fillOpener(openerText(kept.opener, openers), title));
          }
          router.push(`/messages?conversation=${encodeURIComponent(id)}`);
        }}
        className={chatButton}
      >
        <MessageSquare aria-hidden="true" className="size-4" />
        {t.start}
      </button>
      {error && (
        <p role="status" className="text-body text-muted">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * 开场白 (#373): into the box of a conversation with no messages yet and nothing written, as this tab's draft
 * (chat-drafts.ts). Not sent: the job seeker reads it, may change it, and presses 发送.
 */
function putOpener(session: DemoSession, conversationId: string, opener: string) {
  try {
    writeDraftIfEmpty(window.sessionStorage, identityScope(session), conversationId, opener);
  } catch {
    // Some private windows refuse sessionStorage: the box simply starts empty.
  }
}
