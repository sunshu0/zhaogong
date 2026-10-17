"use client";
import { useId, useState } from "react";
import { checkJob, publishDecision, type JobDraft, type PostingEmployer } from "@/lib/compliance";
import type { CountryCode } from "@/lib/types";
import { draftChecklist, type ChecklistItem } from "@/components/employer/draft-checklist";
import { PayReferenceHint } from "@/components/employer/PayReferenceHint";
import { roleNames, suggestJobRoles } from "@/lib/job-roles";

/**
 * The job as the conversation has filled it so far: what it is, then one progress line that opens into
 * the list; tapping an item asks the chat about it again. Not a live region: the chat already speaks.
 */
export function DraftCard({
  draft,
  country,
  employer,
  canAsk,
  onAsk,
}: {
  draft: JobDraft;
  country: CountryCode;
  employer?: PostingEmployer;
  /** Whether the chat can take this item's question now. */
  canAsk: (item: ChecklistItem) => boolean;
  onAsk: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const list = draftChecklist(draft, country, employer);
  const reviewNeeded = publishDecision(checkJob(draft, country, employer)).status === "pending_review";
  const summary = list.items
    .filter((i) => ["时薪", "地区", "工作类型"].includes(i.label) && i.value)
    .map((i) => i.value)
    .join(" · ");

  return (
    <section aria-label="职位卡，随对话更新" className="rounded-card bg-surface p-4 shadow-card text-body">
      <DraftTitle draft={draft} />
      {summary && <p className="mt-1 text-muted">{summary}</p>}
      <DraftRoles draft={draft} />
      {/* #85: once the chat knows the pay and the industry, what the same industry pays on the platform. */}
      {draft.industry && draft.pay?.min != null && (
        <div className="mt-2">
          <PayReferenceHint country={country} industry={draft.industry} regionId={draft.regionId} pay={draft.pay} />
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="pressable mt-3 block min-h-11 w-full text-left"
      >
        <span className="flex items-center justify-between gap-2 text-meta">
          <span className={list.ready ? "text-ok" : "text-foreground"}>
            {list.ready ? "可以预览" : `已填 ${list.done} / ${list.total} 项`}
            {list.problems > 0 && <span className="text-danger"> · {list.problems} 个问题要处理</span>}
          </span>
          <span className="text-brand">{open ? "收起" : "查看各项"}</span>
        </span>
        <span aria-hidden="true" className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-background">
          <span
            className={`block h-full rounded-full transition-[width] duration-(--duration-ui) ease-(--ease-app) ${list.ready ? "bg-ok" : "bg-brand"}`}
            style={{ width: `${Math.round((list.done / list.total) * 100)}%` }}
          />
        </span>
      </button>
      {open && (
        <ul id={listId} className="mt-2 divide-y divide-border">
          {list.items.map((item) => (
            <li key={item.label}>
              <ChecklistRow item={item} enabled={canAsk(item)} onAsk={onAsk} />
            </li>
          ))}
        </ul>
      )}
      {reviewNeeded && <p className="mt-2 text-meta text-warn">这个职位发布后要人工审核。</p>}
    </section>
  );
}

/** 岗位类别 (#96): preselected from the title once the chat knows it and the industry; changed on 预览. */
function DraftRoles({ draft }: { draft: JobDraft }) {
  if (!draft.titleZh || !draft.industry) return null;
  const roles = draft.roles?.length ? draft.roles : suggestJobRoles(draft);
  return (
    <p className="mt-1 text-meta text-muted">
      岗位类别：{roles.length ? roleNames(roles) : "待选"}
      {roles.length ? "（按职位名预选，预览时可以改）" : "（预览时选）"}
    </p>
  );
}

/** A placeholder is not a title: until there is one, say so in plain text. */
function DraftTitle({ draft }: { draft: JobDraft }) {
  if (!draft.titleZh) return <p className="text-muted">还没有职位名称</p>;
  return (
    <>
      <h2 className="text-subtitle font-semibold">{draft.titleZh}</h2>
      {draft.titleEn && (
        <p lang="en" className="text-meta text-muted">
          {draft.titleEn}
        </p>
      )}
    </>
  );
}

function ChecklistRow({ item, enabled, onAsk }: { item: ChecklistItem; enabled: boolean; onAsk: (m: string) => void }) {
  const tone = item.done ? "" : item.required ? "text-warn" : "text-muted";
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => onAsk(item.ask)}
      className="pressable-row -mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-3 rounded-control px-2 py-1.5 text-left enabled:hover:bg-background disabled:cursor-default"
    >
      <span className="w-16 shrink-0 text-muted">{item.label}</span>
      <span className={`min-w-0 flex-1 ${tone}`}>{item.value ?? (item.required ? "待填" : "可不填")}</span>
      {enabled && <span className="shrink-0 text-meta text-brand">{item.done ? "改" : "去填"}</span>}
    </button>
  );
}
