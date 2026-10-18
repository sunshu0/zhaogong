"use client";
import type { CountryCode } from "@/lib/types";
import type { ParseNote } from "@/lib/ai-post/parse";
import { DraftForm } from "@/components/employer/DraftForm";
import { FindingsPanel } from "@/components/employer/FindingsPanel";
import type { DraftFormState } from "@/components/employer/use-draft-form";
import { useMessages } from "@/i18n/client";
import { employerPostMessages } from "@/i18n/messages/employer-post";

/** The editable form with the live checks beside it from 1024 px (above it on phones and tablets). */
export function DraftEditor({
  state,
  country,
  notes = [],
}: {
  state: DraftFormState;
  country: CountryCode;
  /** What the parser wants the employer to know, by note id; the words come from the dictionary. */
  notes?: ParseNote[];
}) {
  const parseNotes = useMessages(employerPostMessages).parseNotes;
  return (
    <div className="gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
      <aside className="mb-4 lg:order-2 lg:mb-0">
        {/* Not ui/wide's STICKY_COLUMN: these pages also have a sticky bottom bar, so the panel stops 9rem short. */}
        <div className="lg:sticky lg:top-18 lg:max-h-[calc(100vh_-_9rem)] lg:overflow-y-auto">
          <FindingsPanel findings={state.findings} missing={state.missing} />
        </div>
      </aside>
      <div className="space-y-4">
        {notes.map((note) => (
          <p key={note} className="rounded-control bg-warn-soft px-3 py-2 text-body text-warn">
            {parseNotes[note]}
          </p>
        ))}
        <DraftForm
          form={state.form}
          set={state.update}
          findings={state.findings}
          missing={state.missing}
          country={country}
          visaChoices={state.visaChoices}
          onRegenerateEn={state.regenerateEnglish}
        />
      </div>
    </div>
  );
}
