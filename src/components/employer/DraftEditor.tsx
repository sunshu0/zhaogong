"use client";
import type { CountryCode } from "@/lib/types";
import { DraftForm } from "@/components/employer/DraftForm";
import { FindingsPanel } from "@/components/employer/FindingsPanel";
import type { DraftFormState } from "@/components/employer/use-draft-form";

/** The editable form with the live checks beside it from 1024 px (above it on phones and tablets). */
export function DraftEditor({
  state,
  country,
  notes = [],
}: {
  state: DraftFormState;
  country: CountryCode;
  notes?: string[];
}) {
  return (
    <div className="gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
      <aside className="mb-4 lg:order-2 lg:mb-0">
        {/* Not ui/wide's STICKY_COLUMN: these pages also have a sticky bottom bar, so the panel stops 9rem short. */}
        <div className="lg:sticky lg:top-18 lg:max-h-[calc(100vh_-_9rem)] lg:overflow-y-auto">
          <FindingsPanel findings={state.findings} missing={state.missing} />
        </div>
      </aside>
      <div className="space-y-4">
        {notes.map((n) => (
          <p key={n} className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
            {n}
          </p>
        ))}
        <DraftForm
          form={state.form}
          set={state.update}
          findings={state.findings}
          missing={state.missing}
          country={country}
          onRegenerateEn={state.regenerateEnglish}
        />
      </div>
    </div>
  );
}
