"use client";
import { useEffect, useId, useState, useTransition } from "react";
import type { AdminResult, Refused } from "@/app/admin/actions";
import {
  approveExternalJob,
  getExternalReview,
  hideExternalJob,
  recordTakedownRequest,
  resumeExternalCompany,
  stopExternalCompany,
  type ExternalCompanyItem,
  type ExternalJobItem,
  type ExternalReviewQueue,
} from "@/app/admin/external-actions";
import { Cancel } from "@/app/admin/_components/Cancel";
import { Empty, Loading } from "@/app/admin/_components/Empty";
import { dayLabel, factLines, FIELD_LABELS, FLAG_LABELS, KIND_LABELS, SOURCE_NAMES } from "@/lib/external-jobs/labels";
import { HIDE_REASONS, type HideReason } from "@/lib/external-jobs/review";
import { Button } from "@/components/ui/Button";
import { Checkbox, Radio } from "@/components/ui/Checkbox";
import { inputClass } from "@/components/ui/input-class";
import { Section } from "@/components/ui/Section";
import { Tag } from "@/components/ui/Tag";

/** The external jobs and companies, loaded again whenever `version` changes; the count is for the tab. */
export function useExternalReview(version: number) {
  const [queue, setQueue] = useState<ExternalReviewQueue | Refused>();
  useEffect(() => {
    let live = true;
    getExternalReview().then((q) => {
      if (live) setQueue(q);
    });
    return () => {
      live = false;
    };
  }, [version]);
  return queue;
}

/**
 * 外部职位 (#112, ADR 0014): imported jobs wait here (先审后显示); the moderator reads the facts beside the
 * original on the company's site, then shows or hides each. Companies can be stopped or removed at their request.
 */
export function ExternalReview({
  queue,
  onDone,
}: {
  queue?: ExternalReviewQueue | Refused;
  onDone: (result: AdminResult) => void;
}) {
  if (!queue) return <Loading />;
  if ("refused" in queue) return <Empty>{queue.error_zh}</Empty>;
  return (
    <div className="space-y-4">
      <p className="text-meta text-muted">
        外部职位从公司招聘系统的公开接口导入，只存事实，审核通过后才出现在「实习」「专业职位」里。请点「看官网原文」对照：事实提取错了、不是软件或电子电气岗位、或有按国籍或种族招人的要求，就选「不显示」。
      </p>
      <Section look="app" title={`待审核 ${queue.pending.length}`}>
        {queue.pending.length === 0 ? (
          <p className="py-group text-body text-muted">没有待审核的外部职位。</p>
        ) : (
          <ul className="divide-y divide-border">
            {queue.pending.map((job) => (
              <li key={job.id}>
                <ExternalJobCard job={job} onDone={onDone} />
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section look="app" title={`已通过 ${queue.approved.length}`}>
        {queue.approved.length === 0 ? (
          <p className="py-group text-body text-muted">还没有通过的外部职位。</p>
        ) : (
          <ul className="divide-y divide-border">
            {queue.approved.map((job) => (
              <li key={job.id}>
                <ExternalJobCard job={job} onDone={onDone} />
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section
        look="app"
        title="公司"
        description="名单在 src/config/external-companies.ts，有人核对过条款、条款允许展示的公司才会导入。停用或记录删除请求后，这家的职位马上全部下架。"
      >
        <ul className="divide-y divide-border">
          {queue.companies.map((company) => (
            <li key={company.id}>
              <CompanyRow company={company} onDone={onDone} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function ExternalJobCard({ job, onDone }: { job: ExternalJobItem; onDone: (result: AdminResult) => void }) {
  const id = useId();
  const [flagsChecked, setFlagsChecked] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState<HideReason>();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<AdminResult>) => startTransition(async () => onDone(await action()));
  const approved = job.review === "approved";

  return (
    <article aria-label={`外部职位：${job.title}`} className="space-y-3 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 lang="en" className="text-subtitle font-semibold">
          {job.title}
        </h3>
        <Tag kind="neutral">{FIELD_LABELS[job.field]}</Tag>
        {job.kind && <Tag kind="neutral">{KIND_LABELS[job.kind]}</Tag>}
        {approved && (job.shown ? <Tag kind="perk">正在显示</Tag> : <Tag kind="neutral">已通过，暂不显示</Tag>)}
      </div>
      <p className="text-meta text-muted">
        {job.companyName} · 首次导入 {dayLabel(job.firstSeenAt)} · 信息取于 {dayLabel(job.lastSeenAt)}
        {approved && !job.shown && "（超过 2 天没刷新到，或已过截止日）"}
      </p>
      {job.flags.length > 0 && (
        <div role="alert" className="space-y-1 rounded-control bg-danger-soft p-3 text-body text-danger">
          <p className="font-medium">需要核对原文：</p>
          <ul className="list-disc pl-5">
            {job.flags.map((flag) => (
              <li key={flag}>{FLAG_LABELS[flag]}</li>
            ))}
          </ul>
          {!approved && (
            <div className="px-2 pt-1 text-foreground">
              <Checkbox checked={flagsChecked} onChange={(e) => setFlagsChecked(e.target.checked)}>
                我看过原文：这是岗位依法需要的要求（如出口管制），不是按国籍或种族挑人
              </Checkbox>
            </div>
          )}
        </div>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-control bg-background p-3 text-body">
        {factLines(job).map((line) => (
          <div key={line.label} className="contents">
            <dt className="text-muted">{line.label}</dt>
            <dd>{line.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-body">
        <a href={job.url} target="_blank" rel="noopener noreferrer nofollow" className="text-brand underline">
          看官网原文
        </a>
      </p>

      {hiding ? (
        <fieldset className="space-y-2 rounded-control border border-danger/40 p-3">
          <legend className="px-1 text-body font-medium">不显示的理由</legend>
          <div className="grid gap-x-4 px-2 sm:grid-cols-2">
            {(Object.keys(HIDE_REASONS) as HideReason[]).map((r) => (
              <Radio key={r} name={`${id}-reason`} checked={reason === r} onChange={() => setReason(r)}>
                {HIDE_REASONS[r]}
              </Radio>
            ))}
          </div>
          <label htmlFor={`${id}-note`} className="block text-body">
            说明{reason === "other" ? "" : "（选填）"}
          </label>
          <textarea
            id={`${id}-note`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={inputClass({ multiline: true })}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              disabled={!reason || (reason === "other" && !note.trim())}
              loading={pending}
              onClick={() => run(() => hideExternalJob(job.id, reason, note))}
            >
              确定不显示
            </Button>
            <Cancel onClick={() => setHiding(false)} />
          </div>
        </fieldset>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {!approved && (
            <Button
              disabled={job.flags.length > 0 && !flagsChecked}
              loading={pending}
              onClick={() => run(() => approveExternalJob(job.id, flagsChecked))}
            >
              通过
            </Button>
          )}
          <Button variant="danger-secondary" onClick={() => setHiding(true)}>
            {approved ? "撤下，不再显示" : "不显示"}
          </Button>
        </div>
      )}
    </article>
  );
}

function CompanyRow({ company, onDone }: { company: ExternalCompanyItem; onDone: (result: AdminResult) => void }) {
  const id = useId();
  const [form, setForm] = useState<"stop" | "takedown" | "resume">();
  const [requester, setRequester] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<AdminResult>) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) setForm(undefined);
      onDone(result);
    });
  const status = company.block
    ? company.block.kind === "takedown"
      ? `公司要求删除（${dayLabel(company.block.createdAt)}）：${company.block.requester ?? ""}`
      : `已停用（${dayLabel(company.block.createdAt)}）：${company.block.note}`
    : !company.onList
      ? "不在名单里（演示数据）"
      : company.terms
        ? company.terms.allowsDisplay
          ? `条款已核对：${company.terms.checkedBy}，${company.terms.checkedOn}`
          : `条款不允许展示（${company.terms.checkedBy}，${company.terms.checkedOn}）`
        : "条款还没核对，不导入";

  return (
    <article aria-label={`外部公司：${company.name}`} className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 lang="en" className="text-body font-semibold">
          {company.name}
        </h3>
        {company.source && <span className="text-meta text-muted">{SOURCE_NAMES[company.source]}</span>}
        {company.imported && <Tag kind="perk">导入中</Tag>}
        {company.block && <Tag kind="urgent">{company.block.kind === "takedown" ? "已删除" : "已停用"}</Tag>}
        <span className="text-meta text-muted">
          待审 {company.pending} · 正在显示 {company.shown}
        </span>
      </div>
      <p className="text-meta text-muted">{status}</p>
      {form ? (
        <fieldset className="space-y-2 rounded-control border border-border p-3">
          <legend className="px-1 text-body font-medium">
            {form === "stop" ? "停用这家公司" : form === "takedown" ? "记录公司的删除请求" : "恢复导入"}
          </legend>
          {form === "takedown" && (
            <>
              <label htmlFor={`${id}-requester`} className="block text-body">
                谁提出的（公司邮箱或部门，不写私人信息）
              </label>
              <input
                id={`${id}-requester`}
                value={requester}
                onChange={(e) => setRequester(e.target.value)}
                className={inputClass()}
              />
            </>
          )}
          <label htmlFor={`${id}-note`} className="block text-body">
            {form === "takedown" ? "请求内容和收到的日期" : "原因"}
          </label>
          <textarea
            id={`${id}-note`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={inputClass({ multiline: true })}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant={form === "resume" ? "primary" : "danger"}
              disabled={!note.trim() || (form === "takedown" && !requester.trim())}
              loading={pending}
              onClick={() =>
                run(() =>
                  form === "stop"
                    ? stopExternalCompany(company.id, note)
                    : form === "takedown"
                      ? recordTakedownRequest(company.id, requester, note)
                      : resumeExternalCompany(company.id, note),
                )
              }
            >
              {form === "stop" ? "确定停用并下架" : form === "takedown" ? "记录并全部下架" : "确定恢复"}
            </Button>
            <Cancel onClick={() => setForm(undefined)} />
          </div>
        </fieldset>
      ) : (
        <div className="flex flex-wrap gap-2">
          {company.block ? (
            <Button variant="secondary" onClick={() => setForm("resume")}>
              恢复导入
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setForm("stop")}>
                停用
              </Button>
              <Button variant="danger-secondary" onClick={() => setForm("takedown")}>
                公司要求删除
              </Button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
