import type { Metadata } from "next";
import { Suspense } from "react";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { RepublishJob } from "@/components/employer/RepublishJob";
import { DetailPageSkeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "复制为新职位", robots: { index: false } };

/** 复制为新职位 (#190): the 重新发布 form, for a job that is live or ended. */
export default function CopyJobPage({ params }: PageProps<"/[lang]/employer/jobs/[id]/copy">) {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <Copy params={params} />
    </Suspense>
  );
}

async function Copy({ params }: Pick<PageProps<"/[lang]/employer/jobs/[id]/copy">, "params">) {
  const { id } = await params;
  return <RepublishJob jobId={id} country={DEFAULT_COUNTRY} mode="copy" />;
}
