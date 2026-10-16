"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { useChat } from "@/components/seeker/chat-client";
import { setIdentity, useHydrated, useSession } from "@/components/seeker/session-client";
import type { Employer, Job } from "@/lib/types";
import { buttonClass, type ButtonSize } from "@/components/ui/Button";

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
  const chatButton = `${buttonClass("primary", { size })} rounded-control font-semibold whitespace-nowrap`;
  const session = useSession();
  const hydrated = useHydrated();
  const router = useRouter();
  const { openEmployerChat } = useChat();
  const [error, setError] = useState("");
  if (closed)
    return <span className="inline-flex min-h-11 items-center text-body whitespace-nowrap text-muted">招聘已结束</span>;
  if (session?.employerId === employer.id)
    return (
      <Link href="/employer/jobs" className="inline-flex min-h-11 items-center text-sm text-brand underline">
        管理本企业职位
      </Link>
    );
  if (!hydrated || !session)
    return (
      <Link href={`/login?role=seeker&next=${encodeURIComponent(`/jobs/${job.id}`)}`} className={chatButton}>
        <MessageSquare aria-hidden="true" className="size-4" />
        立即沟通
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
        切换为求职者
      </button>
    );
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          const id = openEmployerChat(employer, job);
          if (id) router.push(`/messages?conversation=${encodeURIComponent(id)}`);
          else setError("该职位已停止招聘，请查看雇主的其他职位。");
        }}
        className={chatButton}
      >
        <MessageSquare aria-hidden="true" className="size-4" />
        立即沟通
      </button>
      {error && (
        <p role="status" className="text-sm text-muted">
          {error}
        </p>
      )}
    </div>
  );
}
