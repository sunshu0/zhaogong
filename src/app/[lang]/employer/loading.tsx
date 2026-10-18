import { DetailPageSkeleton } from "@/components/ui/Skeleton";
import { employerCommonMessages } from "@/i18n/messages/employer-common";
import { messages } from "@/i18n/server";

// Shown at once while an employer page comes from the server (Round 19): no blank screen between pages.
// The language is the page's root parameter (ADR 0023), so this stays prerendered, one copy per language.
export default async function Loading() {
  const t = (await messages(employerCommonMessages)).loading;
  return <DetailPageSkeleton label={t.employer} />;
}
