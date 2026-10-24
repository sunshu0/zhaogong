import type { Metadata } from "next";
import { NoScriptStreams } from "@/components/seeker/NoScriptStreams";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getEmployer, listJobsByEmployer } from "@/lib/data";
import { requestTime } from "@/components/seeker/request-time";
import { employerActivities } from "@/db/employer-activity";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { DetailPageSkeleton } from "@/components/ui/Skeleton";
import { EmployerPublicPage } from "@/components/seeker/EmployerPublicPage";
import { messages } from "@/i18n/server";
import { seekerEmployerMessages } from "@/i18n/messages/seeker-employer";

export async function generateMetadata({ params }: PageProps<"/[lang]/employers/[id]">): Promise<Metadata> {
  const employer = await getEmployer((await params).id);
  const t = await messages(seekerEmployerMessages);
  return { title: employer && !employer.bannedAt ? t.title(employer.name) : t.missing };
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
  if (!employer || employer.bannedAt) notFound();
  const [allJobs, now] = await Promise.all([listJobsByEmployer(employer.id), requestTime()]);
  const jobs = allJobs
    .filter((job) => job.status === "active" && Date.parse(job.expiresAt) > now)
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
    .map((job) => ({ ...job, contact: {} }));
  const activity = (await employerActivities([employer.id], now)).get(employer.id);
  return <EmployerPublicPage employer={employer} jobs={jobs} activity={activity} />;
}
