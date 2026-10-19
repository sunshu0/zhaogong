"use client";
import { useId, useState, useTransition } from "react";
import type { AdminResult, Refused } from "@/app/[lang]/admin/actions";
import { isFailed, settle, type Failed } from "@/app/[lang]/admin/load-state";
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
} from "@/app/[lang]/admin/external-actions";
import { Cancel } from "@/app/[lang]/admin/_components/Cancel";
import { Empty, Loading } from "@/app/[lang]/admin/_components/Empty";
import { LoadFailed, TryAgain } from "@/app/[lang]/admin/_components/Failed";
import { useAdminLoad } from "@/app/[lang]/admin/_components/use-admin-load";
import { useSwapFocus } from "@/components/ui/use-swap-focus";
import { isDemoCompany } from "@/lib/external-jobs/demo";
import { placedByTitle } from "@/lib/external-jobs/facts";
import { dayLabel, externalWords, factLines, SOURCE_NAMES } from "@/lib/external-jobs/labels";
import { hideReasons, type HideReason } from "@/lib/external-jobs/review";
import { useLang, useMessages } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import { contentLang } from "@/i18n/lang";
import { adminExternalMessages } from "@/i18n/messages/admin-external";
import { Button } from "@/components/ui/Button";
import { Checkbox, Radio } from "@/components/ui/Checkbox";
import { inputClass } from "@/components/ui/input-class";
import { Section } from "@/components/ui/Section";
import { Tag } from "@/components/ui/Tag";

/** The external jobs and companies, loaded again whenever `version` changes; the count is for the tab. */
export function useExternalReview(version: number) {
  return useAdminLoad<ExternalReviewQueue | Refused>(getExternalReview, version);
}

/**
 * 外部职位 (#112, ADR 0014): imported jobs wait here (先审后显示); the moderator reads the facts beside the
 * original on the company's site, then shows or hides each. Companies can be stopped or removed at their request.
 */
export function ExternalReview({
  queue,
  onDone,
  onRetry,
}: {
  queue?: ExternalReviewQueue | Refused | Failed;
  onDone: (result: AdminResult) => void;
  onRetry: () => void;
}) {
  const t = useMessages(adminExternalMessages);
  if (isFailed(queue)) return <LoadFailed what={t.name} onRetry={onRetry} />;
  if (!queue) return <Loading />;
  if ("refused" in queue) return <Empty>{queue.error_zh}</Empty>;
  return (
    <div className="space-y-4">
      <p className="text-meta text-muted">{t.intro}</p>
      {queue.demoJobs > 0 && <p className="rounded-control bg-warn-soft p-3 text-body">{t.demoJobs(queue.demoJobs)}</p>}
      <Section look="app" title={t.pending(queue.pending.length)}>
        {queue.pending.length === 0 ? (
          <p className="py-group text-body text-muted">{t.noPending}</p>
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
      <Section look="app" title={t.approvedHeading(queue.approved.length)}>
        {queue.approved.length === 0 ? (
          <p className="py-group text-body text-muted">{t.noApproved}</p>
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
      <Section look="app" title={t.companies.title} description={t.companies.description}>
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
  const lang = useLang();
  const t = useMessages(adminExternalMessages).job;
  const w = externalWords(lang);
  const id = useId();
  const [flagsChecked, setFlagsChecked] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState<HideReason>();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false); // #183: no answer came; the tick, reason and note stay
  const run = (action: () => Promise<AdminResult>) => {
    setFailed(false);
    startTransition(async () => {
      const result = await settle(action);
      if (result) onDone(result);
      else setFailed(true);
    });
  };
  const approved = job.review === "approved";
  const byDepartment = !placedByTitle(job.title, job.source); // #191
  const { opener: hideOpenerRef, form: hideFormRef } = useSwapFocus(hiding);

  return (
    <article aria-label={t.label(job.title)} className="space-y-3 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 lang="en" className="text-subtitle font-semibold">
          {job.title}
        </h3>
        <Tag kind="neutral">{w.fields[job.field]}</Tag>
        {byDepartment && <Tag kind="neutral">{t.byDepartment}</Tag>}
        {job.kind && <Tag kind="neutral">{w.kinds[job.kind]}</Tag>}
        {approved && (job.shown ? <Tag kind="perk">{t.showing}</Tag> : <Tag kind="neutral">{t.approvedHidden}</Tag>)}
      </div>
      <p className="text-meta text-muted">
        {t.seen(job.companyName, dayLabel(job.firstSeenAt, lang), dayLabel(job.lastSeenAt, lang))}
        {approved && !job.shown && t.whyHidden}
      </p>
      {byDepartment && <p className="text-meta text-muted">{t.byDepartmentNote}</p>}
      {/* #305: a group named by its heading, not an alert: these are there from the start, not news. */}
      {job.flags.length > 0 && (
        <div
          role="group"
          aria-labelledby={`flags-${job.id}`}
          className="space-y-1 rounded-control bg-danger-soft p-3 text-body text-danger"
        >
          <p id={`flags-${job.id}`} className="font-medium">
            {t.checkOriginal}
          </p>
          <ul className="list-disc pl-5">
            {job.flags.map((flag) => (
              <li key={flag}>{w.flags[flag]}</li>
            ))}
          </ul>
          {!approved && (
            <div className="px-2 pt-1 text-foreground">
              <Checkbox checked={flagsChecked} onChange={(e) => setFlagsChecked(e.target.checked)}>
                {t.flagsChecked}
              </Checkbox>
            </div>
          )}
        </div>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-control bg-background p-3 text-body">
        {factLines(job, lang).map((line) => (
          <div key={line.label} className="contents">
            <dt className="text-muted">{line.label}</dt>
            <dd>{line.value}</dd>
          </div>
        ))}
      </dl>
      {/* A made-up company's job (offline demo data, #244) has no posting: its address is example.com (#283). */}
      {isDemoCompany(job.companyId) ? (
        <p className="text-body text-muted">{t.noOriginal}</p>
      ) : (
        <p className="text-body">
          <a href={job.url} target="_blank" rel="noopener noreferrer nofollow" className="text-brand underline">
            {t.original}
          </a>
        </p>
      )}

      {hiding ? (
        <fieldset ref={hideFormRef} className="space-y-2 rounded-control border border-danger/40 p-3">
          <legend className="px-1 text-body font-medium">{t.hideLegend}</legend>
          <div className="grid gap-x-4 px-2 sm:grid-cols-2">
            {(Object.keys(hideReasons(lang)) as HideReason[]).map((r) => (
              <Radio key={r} name={`${id}-reason`} checked={reason === r} onChange={() => setReason(r)}>
                {hideReasons(lang)[r]}
              </Radio>
            ))}
          </div>
          <label htmlFor={`${id}-note`} className="block text-body">
            {reason === "other" ? t.note : t.noteOptional}
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
              {t.confirmHide}
            </Button>
            <Cancel onClick={() => setHiding(false)} />
          </div>
        </fieldset>
      ) : (
        <div ref={hideOpenerRef} className="flex flex-wrap items-center gap-2">
          {!approved && (
            <Button
              disabled={job.flags.length > 0 && !flagsChecked}
              loading={pending}
              onClick={() => run(() => approveExternalJob(job.id, flagsChecked))}
            >
              {t.approve}
            </Button>
          )}
          <Button variant="danger-secondary" onClick={() => setHiding(true)}>
            {approved ? t.takeOff : t.hide}
          </Button>
        </div>
      )}
      {failed && <TryAgain />}
    </article>
  );
}

function CompanyRow({ company, onDone }: { company: ExternalCompanyItem; onDone: (result: AdminResult) => void }) {
  const lang = useLang();
  const t = useMessages(adminExternalMessages).companies;
  const id = useId();
  const [form, setForm] = useState<"stop" | "takedown" | "resume">();
  const [requester, setRequester] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false); // #183: no answer came; the form stays filled in
  const run = (action: () => Promise<AdminResult>) => {
    setFailed(false);
    startTransition(async () => {
      const result = await settle(action);
      if (!result) {
        setFailed(true);
        return;
      }
      if (result.ok) setForm(undefined);
      onDone(result);
    });
  };
  const block = company.block;
  const terms = company.terms;
  const checkedOn = terms ? formatDate(terms.checkedOn, lang, { dateStyle: "medium" }) : "";
  const status = block ? (
    block.kind === "takedown" ? (
      <WithTheirWords
        sentence={(w) => t.takedownOn(dayLabel(block.createdAt, lang), w)}
        words={block.requester ?? ""}
      />
    ) : (
      <WithTheirWords sentence={(w) => t.stoppedOn(dayLabel(block.createdAt, lang), w)} words={block.note} />
    )
  ) : !company.onList ? (
    t.notListed
  ) : terms ? (
    <WithTheirWords
      sentence={(w) => (terms.allowsDisplay ? t.termsChecked(w, checkedOn) : t.termsForbid(w, checkedOn))}
      words={terms.checkedBy}
    />
  ) : (
    t.termsUnchecked
  );
  const { opener: companyOpenerRef, form: companyFormRef } = useSwapFocus(form !== undefined);

  return (
    <article aria-label={t.label(company.name)} className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 lang="en" className="text-body font-semibold">
          {company.name}
        </h3>
        {company.source && <span className="text-meta text-muted">{SOURCE_NAMES[company.source]}</span>}
        {company.imported && <Tag kind="perk">{t.importing}</Tag>}
        {company.block && <Tag kind="urgent">{company.block.kind === "takedown" ? t.removed : t.stopped}</Tag>}
        <span className="text-meta text-muted">{t.counts(company.pending, company.shown)}</span>
      </div>
      <p className="text-meta text-muted">{status}</p>
      {form ? (
        <fieldset ref={companyFormRef} className="space-y-2 rounded-control border border-border p-3">
          <legend className="px-1 text-body font-medium">
            {form === "stop" ? t.stopHeading : form === "takedown" ? t.takedownHeading : t.resumeHeading}
          </legend>
          {form === "takedown" && (
            <>
              <label htmlFor={`${id}-requester`} className="block text-body">
                {t.requester}
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
            {form === "takedown" ? t.takedownNote : t.reason}
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
              {form === "stop" ? t.confirmStop : form === "takedown" ? t.confirmTakedown : t.confirmResume}
            </Button>
            <Cancel onClick={() => setForm(undefined)} />
          </div>
        </fieldset>
      ) : (
        <div ref={companyOpenerRef} className="flex flex-wrap gap-2">
          {company.block ? (
            <Button variant="secondary" onClick={() => setForm("resume")}>
              {t.resume}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setForm("stop")}>
                {t.stop}
              </Button>
              <Button variant="danger-secondary" onClick={() => setForm("takedown")}>
                {t.takedown}
              </Button>
            </>
          )}
        </div>
      )}
      {failed && <TryAgain />}
    </article>
  );
}

const MARK = String.fromCharCode(0);

/**
 * A sentence from the dictionary with someone's own words in it (who checked a company's terms, a note, who asked for
 * a removal): those words are marked lang="zh-CN" when they are Chinese, so an English page reads them as theirs.
 */
function WithTheirWords({ sentence, words }: { sentence: (words: string) => string; words: string }) {
  const [before, after = ""] = sentence(MARK).split(MARK);
  return (
    <>
      {before}
      <span lang={contentLang(words)}>{words}</span>
      {after}
    </>
  );
}
