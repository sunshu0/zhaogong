import type { Metadata } from "next";
import { Suspense } from "react";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { RepublishJob } from "@/components/employer/RepublishJob";
import { DetailPageSkeleton } from "@/components/ui/Skeleton";
import { employerPostMessages } from "@/i18n/messages/employer-post";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { pages } = await messages(employerPostMessages);
  return { title: pages.republishTitle, robots: { index: false } };
}

export default function RepublishJobPage({ params }: PageProps<"/[lang]/employer/jobs/[id]/republish">) {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <Republish params={params} />
    </Suspense>
  );
}

async function Republish({ params }: Pick<PageProps<"/[lang]/employer/jobs/[id]/republish">, "params">) {
  const { id } = await params;
  return <RepublishJob jobId={id} country={DEFAULT_COUNTRY} />;
}
