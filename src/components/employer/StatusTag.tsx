import { PHASE_LABELS, STATUS_LABELS, type Phase, type ShownStatus } from "@/components/employer/job-status";

/** A job's status as a thin-bordered tag, shaped like the ui Tag (Round 13); the colour says the status. */
export function StatusTag({ status }: { status: ShownStatus }) {
  return <LabelTag label={STATUS_LABELS[status]} />;
}

/** The phase 职位管理 shows (#69): 将截止 and 已截止 besides the stored statuses. */
export function PhaseTag({ phase }: { phase: Phase }) {
  return <LabelTag label={PHASE_LABELS[phase]} />;
}

function LabelTag({ label }: { label: { zh: string; className: string } }) {
  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center rounded-sm border bg-surface px-1.5 py-[3px] text-meta leading-none ${label.className}`}
    >
      {label.zh}
    </span>
  );
}

/** Text with its numbers set in the narrow figure face, e.g. 「3 人聊过」 (Round 13: counts read like the pay). */
export function Figures({ children }: { children: string }) {
  return (
    <>
      {children.split(/(\d+)/).map((part, i) =>
        i % 2 ? (
          <span key={i} className="font-figure text-subtitle text-foreground">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
