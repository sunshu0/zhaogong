import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { sharedResume } from "@/db/resume-shares";
import { PrintButton } from "@/components/seeker/PrintButton";
import { ResumePrintStyle, ResumeSheet } from "@/components/seeker/ResumeSheet";

// A shared 中英文简历 (#86): read-only, for people who are not on the platform, so no sign-in. The link is the only
// way in; it is never listed or indexed, and shows nothing once its owner closes it.
export const metadata: Metadata = { title: "中英文简历 · Resume", robots: { index: false, follow: false } };

export default function SharedResumePage({ params }: PageProps<"/resume/[id]">) {
  return (
    <Suspense
      fallback={
        <p role="status" className="py-12 text-muted">
          正在加载简历…
        </p>
      }
    >
      <SharedResume params={params} />
    </Suspense>
  );
}

async function SharedResume({ params }: Pick<PageProps<"/resume/[id]">, "params">) {
  await connection();
  const shared = await sharedResume((await params).id);
  if (!shared) notFound();
  return (
    <div className="space-y-4 py-2">
      <ResumePrintStyle />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-meta text-muted">
          求职者通过找工分享的简历，内容由本人填写。更新于 {shared.updatedAt.slice(0, 10)}
        </p>
        <PrintButton variant="secondary" />
      </div>
      <ResumeSheet doc={shared.resume} />
    </div>
  );
}
