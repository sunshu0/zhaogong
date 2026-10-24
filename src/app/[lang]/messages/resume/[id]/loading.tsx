import { DetailPageSkeleton } from "@/components/ui/Skeleton";
import { messages } from "@/i18n/server";
import { chatMessages } from "@/i18n/messages/chat";

// Shown at once while a résumé from a chat (#379) comes from the server: no blank screen between pages.
export default async function Loading() {
  return <DetailPageSkeleton label={(await messages(chatMessages)).resumePage.loading} />;
}
