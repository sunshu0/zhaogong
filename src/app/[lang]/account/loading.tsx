import { HubPageSkeleton } from "@/components/account/HubSkeletons";
import { accountMessages } from "@/i18n/messages/account";
import { messages } from "@/i18n/server";

// Shown at once while this page comes from the server (Round 19): no blank screen between pages.
export default async function Loading() {
  return <HubPageSkeleton label={(await messages(accountMessages)).loading} cards={[1, 7]} />;
}
