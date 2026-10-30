"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { regionById } from "@/config/countries";
import { INDUSTRY_LABELS, VISA_LABELS } from "@/i18n/labels";
import { contentLang } from "@/i18n/lang";
import { useLang, useMessages } from "@/i18n/client";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import { formatEmploymentTypes } from "@/lib/employment-types";
import { formatHours, jobTagKeys, placeName, postedAgo } from "@/components/seeker/format";
import { EmployerActivityLine } from "@/components/seeker/EmployerActivityLine";
import { isExpired } from "@/components/seeker/job-facts";
import type { PreviewEmployer, PreviewJob } from "@/components/seeker/job-preview";
import { ListPlace } from "@/components/seeker/list-place";
import { StartEmployerChat } from "@/components/seeker/StartEmployerChat";
import { buttonClass } from "@/components/ui/Button";
import { Pay } from "@/components/ui/Pay";
import { FORWARD } from "@/components/ui/PageTransition";
import { Tag } from "@/components/ui/Tag";
import { JOB_TAG_KINDS } from "@/components/ui/tag-kind";
import { VerificationBadge } from "@/components/ui/VerificationBadge";

/** Where the list has a preview column beside it (V6, #376); the column itself shows from Tailwind's `xl`. */
const WIDE = "(min-width: 1280px)";
const JOB_HREF = /\/jobs\/([^/?#]+)$/;

/**
 * The job list with a preview column on wide screens (V6, #376): from 1280 px a plain click on a job card shows the
 * job in the right-hand column instead of opening its page, and marks the card. The cards stay links, so a new tab,
 * a narrower window or a page without its script still opens the job page. The column starts on the first job.
 */
export function JobBrowser({
  jobs,
  employers,
  now,
  demo = false,
  children,
}: {
  jobs: PreviewJob[];
  employers: Record<string, PreviewEmployer>;
  now: number;
  /** The demo site's data (demoDataWanted): the preview says 演示企业 (user feedback 10-30 #2). */
  demo?: boolean;
  /** The list, laid out by the page; this only listens to its clicks. */
  children: ReactNode;
}) {
  const t = useMessages(seekerJobsMessages).list;
  const [selected, setSelected] = useState(jobs[0]?.id);
  const [wide, setWide] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLElement>(null);
  const job = jobs.find((j) => j.id === selected) ?? jobs[0];

  useEffect(() => {
    const query = matchMedia(WIDE);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // The selected card's link says so (aria-current) where the column is there to show it.
  useEffect(() => {
    for (const link of list.current?.querySelectorAll<HTMLAnchorElement>("article a[href]") ?? []) {
      const id = link.getAttribute("href")?.match(JOB_HREF)?.[1];
      if (!id) continue;
      if (wide && id === job?.id) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  }, [wide, job?.id, jobs]);

  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!wide || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>("article a[href]");
    const id = link?.getAttribute("href")?.match(JOB_HREF)?.[1];
    if (!id || !jobs.some((j) => j.id === id)) return;
    event.preventDefault(); // next/link leaves a click that was handled alone
    setSelected(id);
    preview.current?.scrollTo({ top: 0 });
  }

  // 「← 职位列表」 from a job lands where the user was (#409).
  return (
    <ListPlace>
      <div ref={list} className="contents" onClickCapture={onClickCapture}>
        {children}
      </div>
      {/* Only where it shows: below 1280 px the cards open the job page, and the page has no hidden copy. */}
      {wide && job && (
        <aside
          ref={preview}
          aria-label={t.preview}
          className="overflow-y-auto rounded-card bg-surface ring-1 ring-border xl:sticky xl:top-18 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:block xl:max-h-[calc(100vh_-_5.5rem)]"
        >
          <JobPreview key={job.id} job={job} employer={employers[job.employerId]} now={now} demo={demo} />
        </aside>
      )}
    </ListPlace>
  );
}

function JobPreview({
  job,
  employer,
  now,
  demo,
}: {
  job: PreviewJob;
  employer?: PreviewEmployer;
  now: number;
  demo: boolean;
}) {
  const lang = useLang();
  const t = useMessages(seekerJobsMessages);
  const region = regionById(job.country, job.regionId);
  const hours = formatHours(job.hoursPerWeek, lang);
  const shifts = job.shiftsZh?.trim();
  const tags = jobTagKeys(job);
  const join = (items: string[]) => items.join(t.detail.listJoin);
  const closed = isExpired(job, now);
  const part = "px-5 py-4";

  return (
    <div className="divide-y divide-border text-body">
      <div className={part}>
        {tags.length > 0 && (
          <ul className="mb-1.5 flex flex-wrap gap-1.5" aria-label={t.tags.label}>
            {tags.map((tag) => (
              <li key={tag}>
                <Tag kind={JOB_TAG_KINDS[tag]}>{t.tags[tag]}</Tag>
              </li>
            ))}
          </ul>
        )}
        {/* h3: under the list's cards (h2), so a job's title is one level-2 heading on the page. */}
        <h3 lang={contentLang(job.titleZh)} className="text-[1.375rem] leading-tight font-black break-words">
          {job.titleZh}
        </h3>
        <p lang="en" className="font-latin text-muted">
          {job.titleEn}
        </p>
        <p className="mt-2 leading-none">
          <Pay pay={job.pay} country={job.country} size="detail" lang={lang} />
        </p>
        <p className="mt-2 text-meta text-muted">{postedAgo(job.postedAt, now, lang)}</p>
      </div>

      <dl className={`${part} grid grid-cols-[5.5em_minmax(0,1fr)] gap-x-3 gap-y-2`}>
        <dt className="text-muted">{t.detail.region}</dt>
        <dd className="break-words">
          {placeName(region, lang)}
          {job.address && <span className="block text-meta text-muted">{job.address}</span>}
        </dd>
        <dt className="text-muted">{t.detail.hoursAndShifts}</dt>
        <dd className="break-words">
          {hours || shifts ? (
            <>
              {hours}
              {hours && shifts && t.detail.clauseJoin}
              {shifts && <span lang={contentLang(shifts)}>{shifts}</span>}
            </>
          ) : (
            t.detail.notStated
          )}
        </dd>
        <dt className="text-muted">{t.detail.employmentType}</dt>
        <dd>
          {formatEmploymentTypes(job.employmentType, lang)} · {INDUSTRY_LABELS[job.industry][lang]}
        </dd>
        <dt className="text-muted">{t.detail.food}</dt>
        <dd>
          {job.mealsIncluded ? t.detail.meals : t.detail.noMeals} ·{" "}
          {job.accommodationIncluded ? t.detail.housing : t.detail.noHousing}
        </dd>
        <dt className="text-muted">{t.detail.visas}</dt>
        <dd>
          {job.visaAccepted.length ? join(job.visaAccepted.map((v) => VISA_LABELS[v][lang])) : t.detail.notStated}
        </dd>
      </dl>

      {job.descriptionZh && (
        <p lang={contentLang(job.descriptionZh)} className={`${part} whitespace-pre-line break-words`}>
          {job.descriptionZh}
        </p>
      )}

      {employer && (
        <div className={`${part} space-y-1.5`}>
          <p lang={contentLang(employer.name)} className="font-semibold break-words">
            {employer.name}
          </p>
          <EmployerActivityLine activity={employer.activity} lang={lang} />
          <VerificationBadge verification={employer.verification} demo={demo} lang={lang} />
        </div>
      )}

      {/* 立即沟通, the one main button, and the whole page; kept in view at the foot of the column. */}
      <div className="sticky bottom-0 flex gap-2 bg-surface/95 px-5 py-3 backdrop-blur-md">
        {employer && !employer.banned && (
          <div className="min-w-0 flex-1 [&_a]:w-full [&_button]:w-full">
            <StartEmployerChat
              employer={{ id: employer.id, name: employer.name }}
              job={{
                id: job.id,
                employerId: job.employerId,
                titleZh: job.titleZh,
                titleEn: job.titleEn,
                status: job.status,
                expiresAt: job.expiresAt,
              }}
              closed={closed}
            />
          </div>
        )}
        <Link href={`/jobs/${job.id}`} transitionTypes={FORWARD} className={`${buttonClass("secondary")} shrink-0`}>
          {t.list.openFull}
        </Link>
      </div>
    </div>
  );
}
