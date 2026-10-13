import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getEmployer, listJobsByEmployer } from "@/lib/data";
import { requestTime } from "@/components/seeker/request-time";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { EmployerPublicPage } from "@/components/seeker/EmployerPublicPage";

export async function generateMetadata({ params }: PageProps<"/employers/[id]">): Promise<Metadata> {
  const employer = await getEmployer((await params).id);
  return { title: employer && !employer.bannedAt ? `${employer.name} · 雇主主页` : "雇主不存在" };
}

export default function EmployerPage({ params }: PageProps<"/employers/[id]">) {
  return (
    <div className={WIDE_ON_DESKTOP}>
      <Suspense
        fallback={
          <p role="status" className="py-12 text-muted">
            加载雇主主页…
          </p>
        }
      >
        <PublicEmployer params={params} />
      </Suspense>
    </div>
  );
}

async function PublicEmployer({ params }: Pick<PageProps<"/employers/[id]">, "params">) {
  const employer = await getEmployer((await params).id);
  if (!employer || employer.bannedAt) notFound();
  const [allJobs, now] = await Promise.all([listJobsByEmployer(employer.id), requestTime()]);
  const jobs = allJobs
    .filter((job) => job.status === "active" && Date.parse(job.expiresAt) > now)
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
    .map((job) => ({ ...job, contact: {} }));
  return <EmployerPublicPage employer={employer} jobs={jobs} now={now} />;
}
