import { HubPageSkeleton } from "@/components/account/HubSkeletons";
import { notificationsMessages } from "@/i18n/messages/notifications";
import { messages } from "@/i18n/server";

// Shown at once while this page comes from the server (Round 19): no blank screen between pages.
export default async function Loading() {
  return <HubPageSkeleton label={(await messages(notificationsMessages)).loading} cards={[6]} />;
}
