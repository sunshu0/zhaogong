"use server";

// 收藏和进度 (#52, PRD R-28): the signed-in account's saved jobs and how far each got. The account comes from the
// session cookie; nobody else, the employer included, can read another account's list.
import { regionById } from "@/config/countries";
import { getCurrentSession } from "@/lib/auth";
import { getEmployer, getJob } from "@/lib/data";
import { listSavedJobs, saveJob, setSavedStage, unsaveJob } from "@/db/saved-jobs";
import { chatServerStore } from "@/lib/chat-server/store";
import type { CountryCode, PayRange } from "@/lib/types";
import { chatDemo } from "@/components/seeker/chat-demo";
import { EMPTY_CHAT, chatView } from "@/components/seeker/chat-store";
import { identityScope } from "@/components/seeker/identity-scope";
import { isExpired } from "@/components/seeker/job-facts";
import { effectiveStage, jobsContactedInChat, parseSavedStage, type SavedStage } from "@/components/seeker/saved-jobs";

export type SavedJobView = {
  jobId: string;
  titleZh: string;
  titleEn: string;
  pay: PayRange;
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

/** Ids of the account's saved jobs, for the 收藏 buttons; null when signed out. */
export async function mySavedJobIds(): Promise<string[] | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  return (await listSavedJobs(session.email)).map((row) => row.jobId);
}

/** The account's saved jobs, newest first, with the stage to show; null when signed out. */
export async function mySavedJobs(): Promise<SavedJobView[] | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  const rows = await listSavedJobs(session.email);
  // The job seeker identity's chats say which jobs swapped contact details.
  const scope = identityScope({ email: session.email, signedInAt: "", activeRole: "seeker" });
  const record = (await chatServerStore().getChat(scope)) ?? EMPTY_CHAT;
  const contacted = jobsContactedInChat(chatView(record, chatDemo(false)));
  const now = Date.now();
  const views = await Promise.all(
    rows.map(async (row): Promise<SavedJobView | null> => {
      const job = await getJob(row.jobId);
      if (!job) return null;
      const employer = await getEmployer(job.employerId);
      return {
        jobId: job.id,
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
  return views.filter((view): view is SavedJobView => view !== null);
}

/** Saves a job for the account; the ids afterwards, or null when signed out. */
export async function saveMyJob(jobId: string): Promise<string[] | null> {
  const session = await getCurrentSession();
  if (!session || typeof jobId !== "string") return null;
  await saveJob(session.email, jobId);
  return mySavedJobIds();
}

export async function unsaveMyJob(jobId: string): Promise<string[] | null> {
  const session = await getCurrentSession();
  if (!session || typeof jobId !== "string") return null;
  await unsaveJob(session.email, jobId);
  return mySavedJobIds();
}

/** Sets the stage the account picked (it then wins over what the chat says). The list afterwards. */
export async function setMyJobStage(jobId: string, stage: SavedStage): Promise<SavedJobView[] | null> {
  const session = await getCurrentSession();
  if (!session || typeof jobId !== "string") return null;
  const picked = parseSavedStage(stage);
  if (picked) await setSavedStage(session.email, jobId, picked);
  return mySavedJobs();
}
