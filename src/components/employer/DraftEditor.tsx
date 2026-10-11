"use client";
import type { CountryCode } from "@/lib/types";
import { DraftForm } from "@/components/employer/DraftForm";
import { FindingsPanel } from "@/components/employer/FindingsPanel";
import type { DraftFormState } from "@/components/employer/use-draft-form";

/** The editable form with the live checks beside it (above it on a phone). */
export function DraftEditor({ state, country, notes = [] }: { state: DraftFormState; country: CountryCode; notes?: string[] }) {
  return (
    <div className="gap-4 md:grid md:grid-cols-[minmax(0,1fr)_16rem]">
      <aside className="mb-4 md:order-2 md:mb-0">
        <div className="md:sticky md:top-18">
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
