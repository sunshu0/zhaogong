import type { Metadata } from "next";
import { ExternalSectionPage } from "@/components/external/ExternalSectionPage";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { externalMessages } from "@/i18n/messages/external";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(externalMessages)).sections.professionalTitle };
}

// 专业职位 (#113): software and electrical jobs from companies' own sites.
export default function ProfessionalPage({ searchParams }: PageProps<"/[lang]/professional">) {
  return (
    <div className={WIDE_ON_DESKTOP}>
      <ExternalSectionPage section="professional" searchParams={searchParams} />
    </div>
  );
}
