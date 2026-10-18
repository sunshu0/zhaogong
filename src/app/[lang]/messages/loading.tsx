import { ListPageSkeleton } from "@/components/ui/Skeleton";
import { messages } from "@/i18n/server";
import { chatMessages } from "@/i18n/messages/chat";

// Shown at once while 聊天 comes from the server (Round 19): no blank screen between pages.
export default async function Loading() {
  const t = await messages(chatMessages);
  return <ListPageSkeleton label={t.page.loading} />;
}
