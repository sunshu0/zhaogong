"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { useChat } from "@/components/seeker/chat-client";
import { setIdentity, useHydrated, useSession } from "@/components/seeker/session-client";
import type { Employer, Job } from "@/lib/types";
import { buttonClass, type ButtonSize } from "@/components/ui/Button";
import { useMessages } from "@/i18n/client";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import { track } from "@/lib/events/track";

export type ChatJob = Pick<Job, "id" | "employerId" | "titleZh" | "status" | "expiresAt">;
/**
 * 立即沟通: the job page's main action. `size="lg"` in the job page's action bar (Round 19); the label never wraps.
 */
export function StartEmployerChat({
  employer,
  job,
  closed = false,
  size = "md",
}: {
  employer: Pick<Employer, "id" | "name">;
  job: ChatJob;
  closed?: boolean;
  size?: ButtonSize;
}) {
  const t = useMessages(seekerJobsMessages).chat;
  const chatButton = `${buttonClass("primary", { size })} font-semibold whitespace-nowrap`;
  const session = useSession();
  const hydrated = useHydrated();
  const router = useRouter();
  const { openEmployerChat } = useChat();
  const [error, setError] = useState("");
  if (closed)
    return <span className="inline-flex min-h-11 items-center text-body whitespace-nowrap text-muted">{t.closed}</span>;
  if (session?.employerId === employer.id)
    return (
      <Link href="/employer/jobs" className="inline-flex min-h-11 items-center text-sm text-brand underline">
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
        onClick={() => {
          const id = openEmployerChat(employer, job);
          if (id) track({ name: "chat_start", path: "/jobs/[id]", jobId: job.id });
          if (id) router.push(`/messages?conversation=${encodeURIComponent(id)}`);
          else setError(t.stopped);
        }}
        className={chatButton}
      >
        <MessageSquare aria-hidden="true" className="size-4" />
        {t.start}
      </button>
      {error && (
        <p role="status" className="text-sm text-muted">
          {error}
        </p>
      )}
    </div>
  );
}
