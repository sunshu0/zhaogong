import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { resumeInChat } from "@/db/conversations";
import { getCurrentSession } from "@/lib/auth";
import { NoScriptStreams } from "@/components/seeker/NoScriptStreams";
import { PrintButton } from "@/components/seeker/PrintButton";
import { DetailPageSkeleton } from "@/components/ui/Skeleton";
import { ResumePrintStyle, ResumeSheet } from "@/components/seeker/ResumeSheet";
import { formatDate } from "@/i18n/format";
import { contentLang } from "@/i18n/lang";
import { messages, serverLang } from "@/i18n/server";
import { chatMessages } from "@/i18n/messages/chat";

// A 中英文简历 a job seeker sent in a chat (#379, ADR 0037): the page as it was when sent, for the two sides of that
// conversation only — the job seeker, and everyone in the business's team. Anyone else, or signed out, gets the 404.
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(chatMessages)).resumePage.title, robots: { index: false, follow: false } };
}

export default async function ChatResumePage({ params }: PageProps<"/[lang]/messages/resume/[id]">) {
  const t = await messages(chatMessages);
  return (
    <div className="type-app">
      <Suspense fallback={<DetailPageSkeleton label={t.resumePage.loading} />}>
        <ChatResume params={params} />
      </Suspense>
      <NoScriptStreams />
    </div>
  );
}

async function ChatResume({ params }: Pick<PageProps<"/[lang]/messages/resume/[id]">, "params">) {
  await connection();
  const session = await getCurrentSession();
  const id = (await params).id;
  if (!session || !/^[1-9]\d{0,15}$/.test(id)) notFound();
  const reader =
    session.activeRole === "seeker"
      ? ({ side: "seeker", email: session.email } as const)
      : session.employer
        ? ({ side: "employer", employerId: session.employer.id } as const)
        : null;
  const sent = reader && (await resumeInChat(reader, Number(id)));
  if (!sent) notFound();
  const t = (await messages(chatMessages)).resumePage;
  const date = formatDate(sent.sentAt, await serverLang());
  return (
    <div className="space-y-4 py-2">
      <ResumePrintStyle />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href="/messages" className="pressable inline-flex min-h-11 items-center text-meta text-brand">
            {t.back}
          </Link>
          <p className="text-meta text-muted">
            {t.sentTo(date)}
            <span lang={contentLang(sent.employerName)}>{sent.employerName}</span>
          </p>
        </div>
        <PrintButton variant="secondary" />
      </div>
      <ResumeSheet doc={sent.resume} />
    </div>
  );
}
