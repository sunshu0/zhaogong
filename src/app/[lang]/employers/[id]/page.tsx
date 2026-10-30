import { isBanned, isPermanentBan } from "@/lib/employer-ban";
import type { Metadata } from "next";
import { NoScriptStreams } from "@/components/seeker/NoScriptStreams";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getEmployer, listJobsByEmployer } from "@/lib/data";
import { requestTime } from "@/components/seeker/request-time";
import { employerActivities } from "@/db/employer-activity";
import { getBenefits, listApprovedPhotoIds } from "@/db/employer-photos";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { DetailPageSkeleton } from "@/components/ui/Skeleton";
import { EmployerPublicPage } from "@/components/seeker/EmployerPublicPage";
import { messages } from "@/i18n/server";
import { seekerEmployerMessages } from "@/i18n/messages/seeker-employer";
import { demoDataWanted } from "@/db/ready";

export async function generateMetadata({ params }: PageProps<"/[lang]/employers/[id]">): Promise<Metadata> {
  const employer = await getEmployer((await params).id);
  const t = await messages(seekerEmployerMessages);
  // No clock in metadata: only a permanent ban hides the name here; the page itself asks the time (ADR 0044).
  return { title: employer && !isPermanentBan(employer) ? t.title(employer.name) : t.missing };
}

export default async function EmployerPage({ params }: PageProps<"/[lang]/employers/[id]">) {
  const t = await messages(seekerEmployerMessages);
  return (
    <div className={WIDE_ON_DESKTOP}>
      <NoScriptStreams />
      <Suspense fallback={<DetailPageSkeleton label={t.loading} />}>
        <PublicEmployer params={params} />
      </Suspense>
    </div>
  );
}

async function PublicEmployer({ params }: Pick<PageProps<"/[lang]/employers/[id]">, "params">) {
  const employer = await getEmployer((await params).id);
  const now = await requestTime();
  if (!employer || isBanned(employer, now)) notFound();
  const allJobs = await listJobsByEmployer(employer.id);
  const jobs = allJobs
    .filter((job) => job.status === "active" && Date.parse(job.expiresAt) > now)
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
    .map((job) => ({ ...job, contact: {} }));
  const [activities, photos, benefits] = await Promise.all([
    employerActivities([employer.id], now),
    listApprovedPhotoIds(employer.id),
    getBenefits(employer.id),
  ]);
  return (
    <EmployerPublicPage
      employer={employer}
      jobs={jobs}
      activity={activities.get(employer.id)}
      photos={photos}
      benefits={benefits}
      demo={demoDataWanted()}
    />
  );
}
