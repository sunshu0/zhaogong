"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { decideMyChatCandidate, getMyChatCandidate } from "@/app/[lang]/employer/applicant-actions";
import { decisionLabel, type ApplicationDecision } from "@/components/seeker/applications";
import { buttonClass } from "@/components/ui/Button";
import { busyProps } from "@/components/ui/busy";
import { toast } from "@/components/ui/Toast";
import { useLang, useMessages } from "@/i18n/client";
import { employerApplicantsMessages } from "@/i18n/messages/employer-applicants";

/**
 * 合适 and 已录用 under a chat's job bar, on the business's side of a conversation both share (ADR 0030): the same
 * marks as on 聊过这个职位的人, which it links to. 已录用 tells the job seeker, as there. Nothing for a conversation
 * that is not shared (demo chats, demo candidates) or not the business's.
 */
export function ChatCandidateMarks({ conversationId, jobId }: { conversationId: string; jobId: string }) {
  const t = useMessages(employerApplicantsMessages);
  const lang = useLang();
  const [loaded, setLoaded] = useState<{ id: string; decision: ApplicationDecision | null }>();
  const [busy, setBusy] = useState<ApplicationDecision>();
  useEffect(() => {
    let live = true;
    // No answer: no marks, as for a conversation that is not shared.
    getMyChatCandidate(conversationId).then(
      (found) => live && found && setLoaded({ id: conversationId, decision: found.decision }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [conversationId]);
  if (loaded?.id !== conversationId) return null;

  async function mark(button: ApplicationDecision) {
    if (busy || !loaded) return;
    const decision = loaded.decision === button ? null : button;
    setBusy(button);
    const ok = await decideMyChatCandidate(conversationId, decision).catch(() => false);
    setBusy(undefined);
    if (!ok) return toast(t.jobApplicants.saveFailed);
    setLoaded({ id: conversationId, decision });
    toast(decision ? t.jobApplicants.marked(decisionLabel(decision, lang)) : t.jobApplicants.markCleared);
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-1.5 lg:px-6 lg:py-2">
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
