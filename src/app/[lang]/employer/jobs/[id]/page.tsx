import type { Metadata } from "next";
import { Suspense } from "react";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { EditJob } from "@/components/employer/EditJob";
import { DetailPageSkeleton } from "@/components/ui/Skeleton";
import { employerPostMessages } from "@/i18n/messages/employer-post";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { pages } = await messages(employerPostMessages);
  return { title: pages.editTitle, robots: { index: false } };
}

export default function EditJobPage({ params }: PageProps<"/[lang]/employer/jobs/[id]">) {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: Pick<PageProps<"/[lang]/employer/jobs/[id]">, "params">) {
  const { id } = await params;
  return <EditJob jobId={id} country={DEFAULT_COUNTRY} />;
}
