import type { Metadata } from "next";
import { ExternalSectionPage } from "@/components/external/ExternalSectionPage";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";

export const metadata: Metadata = { title: "专业职位（软件、电子电气）" };

// 专业职位 (#113): software and electrical jobs from companies' own sites.
export default function ProfessionalPage({ searchParams }: PageProps<"/professional">) {
  return (
    <div className={WIDE_ON_DESKTOP}>
      <ExternalSectionPage section="professional" searchParams={searchParams} />
    </div>
  );
}
