"use server";

// 收藏和进度 (#52, PRD R-28): the signed-in account's saved jobs and how far each got. The account comes from the
// session cookie; nobody else, the employer included, can read another account's list. External jobs of 实习 and
// 专业职位 (#131) are in the same list, under their save key (externalSaveKey).
import { regionById } from "@/config/countries";
import { getCurrentSession } from "@/lib/auth";
import { getEmployer, getJob } from "@/lib/data";
import { listSavedJobs, saveJob, setSavedStage, unsaveJob } from "@/db/saved-jobs";
import {
  listSavedExternalJobs,
  saveExternalJob,
  setSavedExternalStage,
  unsaveExternalJob,
} from "@/db/saved-external-jobs";
import { getExternalJob } from "@/db/external-jobs";
import { chatServerStore } from "@/lib/chat-server/store";
import type { CountryCode, PayRange } from "@/lib/types";
import { chatDemo } from "@/components/seeker/chat-demo";
import { isDemoAccount } from "@/lib/demo-accounts";
import { EMPTY_CHAT, chatView } from "@/components/seeker/chat-store";
import { identityScope } from "@/components/seeker/identity-scope";
import { isExpired } from "@/components/seeker/job-facts";
import {
  effectiveStage,
  externalIdOfSaveKey,
  externalSaveKey,
  jobsContactedInChat,
  parseSavedStage,
  type SavedStage,
} from "@/components/seeker/saved-jobs";
import { CITY_LABELS, payLabel } from "@/lib/external-jobs/labels";
import { isShown } from "@/lib/external-jobs/visibility";

export type SavedJobView = {
  /** The save key: a job's id, or externalSaveKey of an external job. */
  jobId: string;
  href: string;
  /** An external job of 实习 or 专业职位 (#131): its English title in titleZh, no titleEn, its pay as payText. */
  external: boolean;
  titleZh: string;
  titleEn: string;
  pay?: PayRange;
  payText?: string;
  country: CountryCode;
  region?: string;
  employerName?: string;
  /** Taken down or past its closing date: still listed, marked 已下架. */
  gone: boolean;
  savedAt: string;
  stage: SavedStage;
  /** True once the account picked the stage; false while the chat decides (已收藏 or 已联系). */
  picked: boolean;
};

/** Save keys of the account's saved jobs, external ones included, for the 收藏 buttons; null when signed out. */
export async function mySavedJobIds(): Promise<string[] | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  return [
    ...(await listSavedJobs(session.email)).map((row) => row.jobId),
    ...(await listSavedExternalJobs(session.email)).map((row) => externalSaveKey(row.externalJobId)),
  ];
}

/** The account's saved jobs, newest first, with the stage to show; null when signed out. */
export async function mySavedJobs(): Promise<SavedJobView[] | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  const rows = await listSavedJobs(session.email);
  // The job seeker identity's chats say which jobs swapped contact details.
  const scope = identityScope({ email: session.email, signedInAt: "", activeRole: "seeker" });
  const record = (await chatServerStore().getChat(scope)) ?? EMPTY_CHAT;
  const contacted = jobsContactedInChat(chatView(record, chatDemo(false, isDemoAccount(session.email))));
  const now = Date.now();
  const external = await Promise.all(
    (await listSavedExternalJobs(session.email)).map(async (row): Promise<SavedJobView | null> => {
      const job = await getExternalJob(row.externalJobId);
      if (!job) return null;
      return {
        jobId: externalSaveKey(job.id),
        href: `/external/${encodeURIComponent(job.id)}`,
        external: true,
        titleZh: job.title,
        titleEn: "",
        payText: job.pay ? payLabel(job.pay) : undefined,
        country: "NZ",
        region: CITY_LABELS[job.city],
        employerName: job.companyName,
        gone: !isShown(job, now),
        savedAt: row.savedAt,
        stage: row.stage ?? "saved",
        picked: row.stage !== null,
      };
    }),
  );
  const views = await Promise.all(
    rows.map(async (row): Promise<SavedJobView | null> => {
      const job = await getJob(row.jobId);
      if (!job) return null;
      const employer = await getEmployer(job.employerId);
      return {
        jobId: job.id,
        href: `/jobs/${job.id}`,
        external: false,
        titleZh: job.titleZh,
        titleEn: job.titleEn,
        pay: job.pay,
        country: job.country,
        region: regionById(job.country, job.regionId)?.nameZh,
        employerName: employer?.name,
        gone: job.status !== "active" || isExpired(job, now) || !!employer?.bannedAt,
        savedAt: row.savedAt,
        stage: effectiveStage(row.stage, contacted.has(job.id)),
        picked: row.stage !== null,
      };
    }),
  );
  return [...views, ...external]
    .filter((view): view is SavedJobView => view !== null)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Saves a job for the account; the ids afterwards, or null when signed out. */
export async function saveMyJob(jobId: string): Promise<string[] | null> {
  const session = await getCurrentSession();
  if (!session || typeof jobId !== "string") return null;
  const externalId = externalIdOfSaveKey(jobId);
  if (externalId === undefined) await saveJob(session.email, jobId);
  else await saveExternalJob(session.email, externalId);
  return mySavedJobIds();
}

export async function unsaveMyJob(jobId: string): Promise<string[] | null> {
  const session = await getCurrentSession();
  if (!session || typeof jobId !== "string") return null;
  const externalId = externalIdOfSaveKey(jobId);
  if (externalId === undefined) await unsaveJob(session.email, jobId);
  else await unsaveExternalJob(session.email, externalId);
  return mySavedJobIds();
}

/** Sets the stage the account picked (it then wins over what the chat says). The list afterwards. */
export async function setMyJobStage(jobId: string, stage: SavedStage): Promise<SavedJobView[] | null> {
  const session = await getCurrentSession();
  if (!session || typeof jobId !== "string") return null;
  const picked = parseSavedStage(stage);
  const externalId = externalIdOfSaveKey(jobId);
  if (picked && externalId === undefined) await setSavedStage(session.email, jobId, picked);
  if (picked && externalId !== undefined) await setSavedExternalStage(session.email, externalId, picked);
  return mySavedJobs();
}
