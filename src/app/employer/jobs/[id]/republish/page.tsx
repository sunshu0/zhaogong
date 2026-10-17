import type { Metadata } from "next";
import { Suspense } from "react";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { RepublishJob } from "@/components/employer/RepublishJob";
import { DetailPageSkeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "重新发布职位", robots: { index: false } };

export default function RepublishJobPage({ params }: PageProps<"/employer/jobs/[id]/republish">) {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <Republish params={params} />
    </Suspense>
  );
}

async function Republish({ params }: Pick<PageProps<"/employer/jobs/[id]/republish">, "params">) {
  const { id } = await params;
  return <RepublishJob jobId={id} country={DEFAULT_COUNTRY} />;
}
