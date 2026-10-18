import { DetailPageSkeleton } from "@/components/ui/Skeleton";
import { messages } from "@/i18n/server";
import { seekerEmployerMessages } from "@/i18n/messages/seeker-employer";

// Shown at once while this page comes from the server (Round 19): no blank screen between pages.
export default async function Loading() {
  return <DetailPageSkeleton label={(await messages(seekerEmployerMessages)).loading} />;
}
