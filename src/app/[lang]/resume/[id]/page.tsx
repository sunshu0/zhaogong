import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { sharedResume } from "@/db/resume-shares";
import { NoScriptStreams } from "@/components/seeker/NoScriptStreams";
import { PrintButton } from "@/components/seeker/PrintButton";
import { DetailPageSkeleton } from "@/components/ui/Skeleton";
import { ResumePrintStyle, ResumeSheet } from "@/components/seeker/ResumeSheet";
import { messages } from "@/i18n/server";
import { seekerProfileMessages } from "@/i18n/messages/seeker-profile";

// A shared 中英文简历 (#86): read-only, for people who are not on the platform, so no sign-in. The link is the only
// way in; it is never listed or indexed, and shows nothing once its owner closes it.
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(seekerProfileMessages)).pages.sharedResume, robots: { index: false, follow: false } };
}

export default async function SharedResumePage({ params }: PageProps<"/[lang]/resume/[id]">) {
  const t = await messages(seekerProfileMessages);
  return (
    <div className="type-app">
      <Suspense fallback={<DetailPageSkeleton label={t.pages.loadingResumeEllipsis} />}>
        <SharedResume params={params} />
      </Suspense>
      <NoScriptStreams />
    </div>
  );
}

async function SharedResume({ params }: Pick<PageProps<"/[lang]/resume/[id]">, "params">) {
  await connection();
  const shared = await sharedResume((await params).id);
  if (!shared) notFound();
  const t = await messages(seekerProfileMessages);
  return (
    <div className="space-y-4 py-2">
      <ResumePrintStyle />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-meta text-muted">{t.resume.sharedBy(shared.updatedAt.slice(0, 10))}</p>
        <PrintButton variant="secondary" />
      </div>
      <ResumeSheet doc={shared.resume} />
    </div>
  );
}
