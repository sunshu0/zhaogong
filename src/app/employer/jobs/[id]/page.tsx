import type { Metadata } from "next";
import { Suspense } from "react";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { EditJob } from "@/components/employer/EditJob";
import { DetailPageSkeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "编辑职位", robots: { index: false } };

export default function EditJobPage({ params }: PageProps<"/employer/jobs/[id]">) {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: Pick<PageProps<"/employer/jobs/[id]">, "params">) {
  const { id } = await params;
  return <EditJob jobId={id} country={DEFAULT_COUNTRY} />;
}
