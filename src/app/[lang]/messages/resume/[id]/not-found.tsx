import { FileText } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { StatusCard } from "@/components/seeker/StatusCard";
import { messages } from "@/i18n/server";
import { chatMessages } from "@/i18n/messages/chat";

// A résumé from a chat (#379) the visitor may not see, or that is not there: the same card as a shared one's 404.
export default async function ChatResumeNotFound() {
  const t = (await messages(chatMessages)).resumePage;
  return (
    <StatusCard icon={FileText} title={t.notFound} actions={<ButtonLink href="/messages">{t.toChat}</ButtonLink>}>
      {t.notFoundBody}
    </StatusCard>
  );
}
