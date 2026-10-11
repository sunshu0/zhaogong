"use client";
import { useMemo, useState } from "react";
import { englishSummary, missingFields } from "@/lib/ai-post";
import { checkJob, publishDecision } from "@/lib/compliance";
import type { CountryCode } from "@/lib/types";
import { draftFromForm, emptyForm, type PostForm } from "@/components/employer/post-form";

/**
 * Form state for posting and editing, with the live checks. The English description follows the
 * form until the employer edits it by hand (`englishByHand`).
 */
export function useDraftForm(country: CountryCode, initial: { form?: PostForm; englishByHand?: boolean } = {}) {
  const [form, setForm] = useState<PostForm>(initial.form ?? emptyForm);
  const [englishByHand, setEnglishByHand] = useState(initial.englishByHand ?? false);

  const draft = useMemo(() => draftFromForm(form, country), [form, country]);
  const findings = useMemo(() => checkJob(draft, country), [draft, country]);
  const missing = useMemo(() => missingFields(draft), [draft]);
  const decision = publishDecision(findings);

  function update(patch: Partial<PostForm>) {
    const byHand = englishByHand || "descriptionEn" in patch;
    if (byHand !== englishByHand) setEnglishByHand(true);
    setForm((prev) => {
      const next = { ...prev, ...patch };
      return byHand ? next : { ...next, descriptionEn: englishSummary(draftFromForm(next, country), country) };
    });
  }

  function regenerateEnglish() {
    setEnglishByHand(false);
    setForm((prev) => ({ ...prev, descriptionEn: englishSummary(draftFromForm(prev, country), country) }));
  }

  /** Replaces the whole form, e.g. with a parsed message. */
  function reset(next: PostForm, englishFromForm = true) {
    setForm(next);
    setEnglishByHand(!englishFromForm);
  }

  return {
    form,
    update,
    reset,
    regenerateEnglish,
    draft,
    findings,
    missing,
    decision,
    ready: decision.canPublish && missing.length === 0,
  };
}

export type DraftFormState = ReturnType<typeof useDraftForm>;

export function holdReason(problems: number, missing: number): string {
  const parts = [problems && `${problems} 个问题要处理`, missing && `${missing} 项没填`].filter(Boolean);
  return parts.join("，");
}
