"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { decideMyChatCandidate, getMyChatCandidate } from "@/app/[lang]/employer/applicant-actions";
import { decisionLabel, type ApplicationDecision } from "@/components/seeker/applications";
import { buttonClass } from "@/components/ui/Button";
import { busyProps } from "@/components/ui/busy";
import { showThenSend } from "@/components/ui/optimistic";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { useLang, useMessages } from "@/i18n/client";
import { employerApplicantsMessages } from "@/i18n/messages/employer-applicants";

/**
 * 合适 and 已录用 under a chat's job bar, on the business's side of a conversation both share (ADR 0030): the same
 * marks as on 聊过这个职位的人, which it links to. 已录用 tells the job seeker, as there. Nothing for a conversation
 * that is not shared (demo chats, demo candidates) or not the business's. A press shows at once and is taken back if
 * the server does not keep it (#405); while the marks load, grey shapes hold their place (T5).
 */
export function ChatCandidateMarks({ conversationId, jobId }: { conversationId: string; jobId: string }) {
  const t = useMessages(employerApplicantsMessages);
  const lang = useLang();
  const [loaded, setLoaded] = useState<{ id: string; decision: ApplicationDecision | null }>();
  // The conversation found to have no marks: not shared, not the business's, or no answer.
  const [noneFor, setNoneFor] = useState<string>();
  const [busy, setBusy] = useState<ApplicationDecision>();
  useEffect(() => {
    let live = true;
    // No answer: no marks, as for a conversation that is not shared.
    getMyChatCandidate(conversationId).then(
      (found) =>
        live && (found ? setLoaded({ id: conversationId, decision: found.decision }) : setNoneFor(conversationId)),
      () => live && setNoneFor(conversationId),
    );
    return () => {
      live = false;
    };
  }, [conversationId]);
  if (noneFor === conversationId) return null;
  if (loaded?.id !== conversationId)
    return (
      <div aria-hidden="true" className={`${ROW} justify-between`}>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-16" />
          <Skeleton className="h-11 w-20" />
        </div>
        <Skeleton className="h-4 w-24" />
      </div>
    );

  async function mark(button: ApplicationDecision) {
    if (busy || !loaded) return;
    const before = loaded.decision;
    const decision = before === button ? null : button;
    setBusy(button);
    const sent = await showThenSend({
      show: () => setLoaded({ id: conversationId, decision }),
      undo: () => setLoaded({ id: conversationId, decision: before }),
      send: () => decideMyChatCandidate(conversationId, decision),
    });
    setBusy(undefined);
    if (!sent.ok) return toast(t.jobApplicants.saveFailed);
    toast(decision ? t.jobApplicants.marked(decisionLabel(decision, lang)) : t.jobApplicants.markCleared);
  }

  return (
    <div className={ROW}>
      <div role="group" aria-label={t.chatMarks.label} className="flex gap-2">
        {(["fit", "hired"] as const).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={loaded.decision === d}
            onClick={() => void mark(d)}
            className={`${buttonClass("secondary")} ${loaded.decision === d ? "bg-brand-soft" : ""}`}
            {...busyProps(busy !== undefined)}
            aria-busy={busy === d || undefined}
          >
            {decisionLabel(d, lang)}
          </button>
        ))}
      </div>
      <Link
        href={`/employer/jobs/${jobId}/applicants`}
        className="ml-auto text-meta text-brand underline-offset-4 hover:underline"
      >
        {t.chatMarks.all}
      </Link>
    </div>
  );
}

/** The marks' row; its placeholder has the same height (h-11 like the buttons, the same padding). */
const ROW = "flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-1.5 lg:px-6 lg:py-2";
