import type { Metadata } from "next";
import { NoScriptStreams } from "@/components/seeker/NoScriptStreams";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getEmployer, listJobsByEmployer } from "@/lib/data";
import { requestTime } from "@/components/seeker/request-time";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { DetailPageSkeleton } from "@/components/ui/Skeleton";
import { EmployerPublicPage } from "@/components/seeker/EmployerPublicPage";

export async function generateMetadata({ params }: PageProps<"/[lang]/employers/[id]">): Promise<Metadata> {
  const employer = await getEmployer((await params).id);
  return { title: employer && !employer.bannedAt ? `${employer.name} · 企业主页` : "雇主不存在" };
}

export default function EmployerPage({ params }: PageProps<"/[lang]/employers/[id]">) {
  return (
    <div className={WIDE_ON_DESKTOP}>
      <NoScriptStreams />
      <Suspense fallback={<DetailPageSkeleton label="加载企业主页…" />}>
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
  return <EmployerPublicPage employer={employer} jobs={jobs} />;
}
