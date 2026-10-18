import type { Metadata } from "next";
import { ExternalSectionPage } from "@/components/external/ExternalSectionPage";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { externalMessages } from "@/i18n/messages/external";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(externalMessages)).sections.internshipTitle };
}

// 实习 (#113): internships and graduate programmes from companies' own sites.
export default function InternshipsPage({ searchParams }: PageProps<"/[lang]/internships">) {
  return (
    <div className={WIDE_ON_DESKTOP}>
      <ExternalSectionPage section="internship" searchParams={searchParams} />
    </div>
  );
}
