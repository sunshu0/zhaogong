import { ListPageSkeleton } from "@/components/ui/Skeleton";
import { messages } from "@/i18n/server";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";

// Shown at once while this page comes from the server (Round 19): no blank screen between pages.
export default async function Loading() {
  return <ListPageSkeleton label={(await messages(seekerMeMessages)).pages.loadingHistory} />;
}
