import { ListPageSkeleton } from "@/components/ui/Skeleton";
import { employerApplicantsMessages } from "@/i18n/messages/employer-applicants";
import { messages } from "@/i18n/server";

// Shown at once while 推荐人才 comes from the server (Round 19): no blank screen between pages.
export default async function Loading() {
  const t = await messages(employerApplicantsMessages);
  return <ListPageSkeleton label={t.candidatesPage.loading} />;
}
