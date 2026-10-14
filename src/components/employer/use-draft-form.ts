"use client";
import { useMemo, useState, type FocusEvent } from "react";
import { englishSummary, missingFields } from "@/lib/ai-post";
import { checkJob, publishDecision } from "@/lib/compliance";
import { COUNTRIES } from "@/config/countries";
import type { CountryCode, Employer } from "@/lib/types";
import { draftFromForm, emptyForm, type PostForm } from "@/components/employer/post-form";

/**
 * Form state for posting and editing, with the live checks. The English description follows the
 * form until the employer edits it by hand (`englishByHand`).
 */
export function useDraftForm(
  country: CountryCode,
  initial: { form?: PostForm; englishByHand?: boolean } = {},
  employer?: Pick<Employer, "verification">,
) {
  const [form, setForm] = useState<PostForm>(initial.form ?? emptyForm);
  const [englishByHand, setEnglishByHand] = useState(initial.englishByHand ?? false);

  const draft = useMemo(() => draftFromForm(form, country), [form, country]);
  const findings = useMemo(() => checkJob(draft, country, employer), [draft, country, employer]);
  // AEWV holders only for accredited employers; a job that already lists it keeps the chip so it can be taken off.
  const visaChoices = COUNTRIES[country].visaTypes.filter(
    (v) => v !== "aewv" || employer?.verification === "accredited_employer" || form.visaAccepted.includes(v),
  );
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
    visaChoices,
    ready: decision.canPublish && missing.length === 0,
  };
}

export type DraftFormState = ReturnType<typeof useDraftForm>;

/**
 * For the content above a sticky bottom bar (never on the bar itself): controls scrolled into view by
 * Tab keep clear of the sticky header (3.5rem) and the bar (about 4.5rem), so a focused field is never
 * hidden. Spread `{...clearOfBars}` on the content's container.
 */
export const CLEAR_OF_STICKY_BARS =
  "[&_:is(a,button,input,select,textarea)]:scroll-mt-20 [&_:is(a,button,input,select,textarea)]:scroll-mb-28";

/**
 * Tab scrolls a field into the window but not always clear of the sticky bars (tall fields on a
 * phone); scrollIntoView honours the scroll margins above and does nothing when it is already clear.
 */
export function keepFocusClear(e: FocusEvent<HTMLElement>) {
  const el = e.target as HTMLElement;
  // Keyboard focus only: scrolling on a mouse press moves the button away before the click lands.
  if (el.matches(":focus-visible")) el.scrollIntoView({ block: "nearest" });
}

export function holdReason(problems: number, missing: number): string {
  const parts = [problems && `${problems} 个问题要处理`, missing && `${missing} 项没填`].filter(Boolean);
  return parts.join("，");
}
