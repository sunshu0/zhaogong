import { connection } from "next/server";
import { preparingSections } from "@/lib/external-jobs/section-counts";
import type { ExternalSection } from "@/lib/external-jobs/filter";
import { uiMessages } from "@/i18n/messages/ui";
import { messages } from "@/i18n/server";

/**
 * 筹备中 after a link to a section of external jobs while it has no job (user feedback 10-30 #4). Asked at request
 * time: put it in a Suspense with no fallback, inside the link.
 */
export async function PreparingMark({ section }: { section: ExternalSection }) {
  await connection();
  if (!(await preparingSections()).includes(section)) return null;
  const { nav } = await messages(uiMessages);
  return <span className="ml-1 text-meta font-normal text-muted">{nav.preparing}</span>;
}
