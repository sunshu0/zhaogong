import type { Metadata } from "next";
import { Suspense } from "react";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { RepublishJob } from "@/components/employer/RepublishJob";

export const metadata: Metadata = { title: "重新发布职位", robots: { index: false } };

export default function RepublishJobPage({ params }: PageProps<"/employer/jobs/[id]/republish">) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md border border-border bg-surface" />}>
      <Republish params={params} />
    </Suspense>
  );
}

async function Republish({ params }: Pick<PageProps<"/employer/jobs/[id]/republish">, "params">) {
  const { id } = await params;
  return <RepublishJob jobId={id} country={DEFAULT_COUNTRY} />;
}
