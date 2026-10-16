import type { Metadata } from "next";
import { ExternalSectionPage } from "@/components/external/ExternalSectionPage";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";

export const metadata: Metadata = { title: "实习和毕业生项目（软件、电子电气）" };

// 实习 (#113): internships and graduate programmes from companies' own sites.
export default function InternshipsPage({ searchParams }: PageProps<"/internships">) {
  return (
    <div className={WIDE_ON_DESKTOP}>
      <ExternalSectionPage section="internship" searchParams={searchParams} />
    </div>
  );
}
