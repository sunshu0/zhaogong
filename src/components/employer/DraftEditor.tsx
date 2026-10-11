"use client";
import type { ReactNode } from "react";
import type { CountryCode } from "@/lib/types";
import { DraftForm } from "@/components/employer/DraftForm";
import { FindingsPanel } from "@/components/employer/FindingsPanel";
import type { DraftFormState } from "@/components/employer/use-draft-form";

/** The editable form with the live checks beside it from 1024 px (above it on phones and tablets). */
export function DraftEditor({ state, country, notes = [] }: { state: DraftFormState; country: CountryCode; notes?: string[] }) {
  return (
    <div className="gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
      <aside className="mb-4 lg:order-2 lg:mb-0">
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

/**
 * At 1024 px and up: as wide as min(64rem, the window), centred on the page, beyond the 48rem main
 * column, so the form and the checks fit side by side. 100vw counts the scrollbar, so 1.5rem is left
 * a side to keep about 1rem of margin. Classes, so sticky bars can use them on themselves too.
 */
export const WIDE_ON_DESKTOP = "lg:mr-0 lg:ml-[calc(50%_-_min(32rem,_50vw_-_1.5rem))] lg:w-[min(64rem,_100vw_-_3rem)]";

export function WideOnDesktop({ children }: { children: ReactNode }) {
  return <div className={WIDE_ON_DESKTOP}>{children}</div>;
}
